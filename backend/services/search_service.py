"""
DuckDuckGo Web Search service to retrieve real-time agricultural information.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

class WebSearchService:
    def __init__(self, max_results: int = 3):
        self.max_results = max_results

    def search(self, query: str) -> str:
        """
        Queries DuckDuckGo and formats the top search results.
        """
        if not query:
            return ""

        try:
            try:
                from ddgs import DDGS
            except ImportError:
                from duckduckgo_search import DDGS
                
            logger.info("Querying DuckDuckGo: '%s'", query)
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=self.max_results))

            if not results:
                logger.info("No search results returned from DuckDuckGo.")
                return ""

            passages = []
            for r in results:
                title = r.get("title", "No Title")
                body = r.get("body", "")
                href = r.get("href", "")
                passages.append(f"Source: {title} ({href})\n{body}")

            return "=== DuckDuckGo Web Search Results ===\n" + "\n---\n".join(passages) + "\n=== End Search Results ===\n"
        except Exception as e:
            logger.warning("DuckDuckGo search failed: %s", e)
            return ""
