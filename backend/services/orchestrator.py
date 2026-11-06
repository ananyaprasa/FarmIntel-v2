"""
Orchestrator: merges disease, soil, and crop model outputs
and applies confidence thresholds before sending to RAG + LLM.
"""

import logging
from typing import Optional, AsyncGenerator

logger = logging.getLogger(__name__)

# ── Confidence thresholds ─────────────────────────────────────────────────────
DISEASE_THRESHOLD = 60.0   # below → flag as uncertain
SOIL_THRESHOLD    = 55.0
CROP_MIN_PROB     = 30.0   # only pass recommendations above this probability


class Orchestrator:
    """
    Combines partial or full model results into a single analysis dict
    that flows into the RAG + LLM pipeline.
    """

    def merge(
        self,
        disease_result: Optional[dict] = None,
        soil_result:    Optional[dict] = None,
        crop_result:    Optional[dict] = None,
    ) -> dict:
        """
        Returns a merged analysis dict with uncertainty flags.
        Any of the three inputs may be None (partial analysis).
        """
        merged: dict = {
            "disease":  None,
            "soil":     None,
            "crop":     None,
            "warnings": [],
            "summary":  "",
        }

        # ── Disease ───────────────────────────────────────────────────────────
        if disease_result:
            conf = disease_result.get("confidence", 0)
            if 0 < conf <= 1.0:
                conf = conf * 100.0
            uncertain = conf < DISEASE_THRESHOLD
            merged["disease"] = {
                **disease_result,
                "confidence": conf,
                "uncertain": uncertain,
            }
            if uncertain:
                merged["warnings"].append(
                    f"Disease detection confidence is low ({conf:.1f}%). "
                    "Consider uploading a clearer image."
                )

        # ── Soil ──────────────────────────────────────────────────────────────
        if soil_result:
            conf = soil_result.get("confidence", 0)
            if 0 < conf <= 1.0:
                conf = conf * 100.0
            uncertain = conf < SOIL_THRESHOLD
            merged["soil"] = {
                **soil_result,
                "confidence": conf,
                "uncertain": uncertain,
            }
            if uncertain:
                merged["warnings"].append(
                    f"Soil classification confidence is low ({conf:.1f}%). "
                    "Try a closer, well-lit image of bare soil."
                )

        # ── Crop ──────────────────────────────────────────────────────────────
        if crop_result:
            recs = crop_result.get("recommendations", [])
            normalized_recs = []
            for r in recs:
                prob = r.get("probability", 0)
                if 0 < prob <= 1.0:
                    prob = prob * 100.0
                normalized_recs.append({**r, "probability": prob})

            filtered_recs = [
                r for r in normalized_recs
                if r["probability"] >= CROP_MIN_PROB
            ]
            top_rec = (
                crop_result.get("recommended_crop")
                or (normalized_recs[0]["crop"] if normalized_recs else "Unknown")
            )

            merged["crop"] = {
                **crop_result,
                "recommended_crop": top_rec,
                "recommendations": filtered_recs or normalized_recs[:1],
            }
            if crop_result.get("input_warnings"):
                merged["warnings"].extend(crop_result["input_warnings"])

        merged["summary"] = self._build_summary(merged)
        return merged

    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _build_summary(merged: dict) -> str:
        parts = []

        d = merged.get("disease")
        if d:
            disease_name = d.get("disease", "Unknown")
            conf = d.get("confidence", 0)
            if d.get("is_healthy"):
                parts.append("Plant appears healthy.")
            elif d.get("uncertain"):
                parts.append(f"Possible disease detected: {disease_name} (low confidence).")
            else:
                parts.append(f"Disease detected: {disease_name} ({conf:.1f}% confidence).")

        s = merged.get("soil")
        if s:
            soil_type = s.get("soil_type", "Unknown")
            props = s.get("properties", {})
            fertility = s.get("fertility") or props.get("Fertility") or "?"
            drainage = s.get("drainage") or props.get("Drainage") or "?"
            parts.append(
                f"Soil type: {soil_type} — "
                f"fertility {fertility}, "
                f"drainage {drainage}."
            )

        c = merged.get("crop")
        if c:
            top = (
                c.get("recommended_crop")
                or (c.get("recommendations", [{}])[0].get("crop", "Unknown") if c.get("recommendations") else "Unknown")
            )
            parts.append(f"Recommended crop: {top}.")

        return " ".join(parts) if parts else "No analysis data available."

    def build_llm_context(self, merged: dict, language: str = "en") -> str:
        """
        Formats the merged analysis into a structured string for the LLM prompt.
        """
        lines = ["=== Farm Analysis Report ===", merged["summary"], ""]

        d = merged.get("disease")
        if d:
            disease_name = d.get("disease", "Unknown")
            conf = d.get("confidence", 0)
            lines.append("## Disease Detection")
            lines.append(f"- Detected: {disease_name}")
            lines.append(f"- Confidence: {conf:.1f}%")
            if d.get("uncertain"):
                lines.append("- Note: confidence below threshold — treat with caution")
            treatments = d.get("treatments") or ([d["treatment"]] if d.get("treatment") else [])
            if treatments:
                lines.append(
                    "- Suggested treatments: "
                    + ("; ".join(treatments) if isinstance(treatments, list) else str(treatments))
                )
            lines.append("")

        s = merged.get("soil")
        if s:
            soil_type = s.get("soil_type", "Unknown")
            conf = s.get("confidence", 0)
            props = s.get("properties", {})
            lines.append("## Soil Analysis")
            lines.append(f"- Type: {soil_type} ({conf:.1f}% confidence)")
            lines.append(f"- Water retention: {s.get('water_retention') or props.get('Water Retention', '?')}")
            lines.append(f"- Drainage: {s.get('drainage') or props.get('Drainage', '?')}")
            lines.append(f"- Fertility: {s.get('fertility') or props.get('Fertility', '?')}")
            crops = s.get("suitable_crops") or props.get("Suitable Crops")
            if crops:
                lines.append(
                    "- Suitable crops: "
                    + (", ".join(crops) if isinstance(crops, list) else str(crops))
                )
            tips = s.get("tips") or props.get("Tips")
            if tips:
                lines.append(
                    "- Soil management tips: "
                    + ("; ".join(tips) if isinstance(tips, list) else str(tips))
                )
            lines.append("")

        c = merged.get("crop")
        if c:
            top = (
                c.get("recommended_crop")
                or (c.get("recommendations", [{}])[0].get("crop", "Unknown") if c.get("recommendations") else "Unknown")
            )
            lines.append("## Crop Recommendation")
            lines.append(f"- Top recommendation: {top}")
            if c.get("recommendations"):
                alts = [
                    f"{r.get('crop', 'Unknown')} ({r.get('probability', 0):.1f}%)"
                    for r in c["recommendations"][:3]
                ]
                lines.append("- Alternatives: " + ", ".join(alts))
            if c.get("tip"):
                lines.append(f"- Tip: {c['tip']}")
            lines.append("")

        if merged.get("warnings"):
            lines.append("## Warnings")
            for w in merged["warnings"]:
                lines.append(f"- {w}")

        lang_map = {
            "ta": "Tamil (தமிழ்)",
            "hi": "Hindi (हिन्दी)",
            "te": "Telugu (తెలుగు)",
            "en": "English",
        }
        lines.append(f"\n[Respond in {lang_map.get(language, 'English')}]")

        return "\n".join(lines)

    async def stream_advice(
        self,
        payload: dict,
        rag_service: Optional["RAGService"],
        llm_service: "LLMService",
        search_service: Optional["WebSearchService"] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Merges multi-model results, retrieves related knowledge from FAISS or DuckDuckGo,
        and streams the final customized advice from OpenAI.
        """
        # 1. Merge partial results
        merged = self.merge(
            disease_result=payload.get("disease_result"),
            soil_result=payload.get("soil_result"),
            crop_result=payload.get("crop_result"),
        )
        language = payload.get("language", "en")
        context = self.build_llm_context(merged, language=language)

        # 2. Query Search or RAG
        question = payload.get("question") or ""
        
        # Build query for DuckDuckGo search or offline RAG
        query = ""
        if question:
            query = question
        else:
            # Construct a clean keyword query from merged analysis results
            query_parts = []
            d = merged.get("disease")
            if d and not d.get("is_healthy"):
                disease_name = d.get("disease", "").replace("—", " ").strip()
                if disease_name and disease_name != "Unknown":
                    query_parts.append(f"{disease_name} treatment")
            
            s = merged.get("soil")
            if s:
                soil_type = s.get("soil_type", "").strip()
                if soil_type and soil_type != "Unknown":
                    query_parts.append(f"{soil_type} characteristics agriculture")
                    
            c = merged.get("crop")
            if c:
                recommended_crop = c.get("recommended_crop", "").strip()
                if recommended_crop and recommended_crop != "Unknown":
                    query_parts.append(f"{recommended_crop} cultivation")
                    
            query = " ".join(query_parts) if query_parts else "sustainable farming tips"
        
        reference_knowledge = ""
        if search_service and query:
            reference_knowledge = search_service.search(query)
        elif rag_service and query:
            reference_knowledge = rag_service.retrieve(query, top_k=4)

        # 3. Stream from LLM
        async for chunk in llm_service.stream(
            context=context,
            rag_passages=reference_knowledge,
            prompt=question,
        ):
            yield chunk


