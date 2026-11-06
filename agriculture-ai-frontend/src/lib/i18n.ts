export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

type Dict = {
  brand: string;
  brandSub: string;
  systemReady: string;
  nav: { disease: string; soil: string; crop: string; weather: string; advice: string };

  disease: {
    title: string;
    subtitle: string;
    workflowId: string;
    dropTitle: string;
    dropHint: string;
    select: string;
    analyzing: string;
    result: string;
    confidence: string;
    urgency: string;
    urgencyLow: string;
    urgencyMid: string;
    urgencyHigh: string;
    action: string;
    reset: string;
    error: string;
  };

  soil: {
    title: string;
    subtitle: string;
    workflowId: string;
    dropTitle: string;
    dropHint: string;
    select: string;
    analyzing: string;
    result: string;
    confidence: string;
    properties: string;
    reset: string;
    error: string;
    uploadGuidance: string;
    emptyUpload: string;
    tooLargeUpload: string;
    modelScore: string;
    notCalibrated: string;
    generalInfo: string;
    otherScores: string;
    disclaimerTitle: string;
    disclaimerVisual: string;
    disclaimerCrop: string;
  };

  crop: {
    title: string;
    subtitle: string;
    n: string;
    p: string;
    k: string;
    temperature: string;
    humidity: string;
    ph: string;
    rainfall: string;
    acidic: string;
    alkaline: string;
    submit: string;
    submitting: string;
    ranked: string;
    match: string;
    error: string;
    exampleDataNote: string;
    exampleResultWarning: string;
    recommended: string;
    reset: string;
    exampleSource: string;
    manualSource: string;
    helpNutrients: string;
    helpTemperature: string;
    helpHumidity: string;
    helpPh: string;
    helpRainfall: string;
    rainfallPeriodNote: string;
    weatherNote: string;
    required: string;
    invalidNumber: string;
    outOfRange: string;
    modelSource: string;
    catboostSource: string;
    fallbackSource: string;
    unknownSource: string;
    modelScore: string;
    profileScore: string;
    unknownScore: string;
    scoreNoteCatboost: string;
    scoreNoteFallback: string;
    scoreNoteUnknown: string;
    rank: string;
    explanationCatboost: string;
    explanationFallback: string;
    explanationUnknown: string;
    factorsUnavailable: string;
    tipLabel: string;
    tipEnglish: string;
    inputWarnings: string;
    idleResults: string;
    emptyResults: string;
    requestFailed: string;
    retry: string;
  };

  advice: {
    title: string;
    subtitle: string;
    context: string;
    noContext: string;
    ask: string;
    placeholder: string;
    streaming: string;
    error: string;
  };
  weather: WeatherDict;
};

type WeatherDict = {
  title: string;
  subtitle: string;
  location: string;
  selectedLocation: string;
  coordinates: string;
  selectedDate: string;
  selectedDay: string;
  overview: string;
  high: string;
  low: string;
  condition: string;
  rainChance: string;
  precipitation: string;
  sunrise: string;
  sunset: string;
  humidity: string;
  wind: string;
  feelsLike: string;
  temperature: string;
  hourlyForecast: string;
  hourlyDescription: string;
  loading: string;
  loadingDescription: string;
  unavailable: string;
  requestFailed: string;
  retry: string;
  empty: string;
  emptyDescription: string;
  cropTitle: string;
  cropSubtitle: string;
  profileScore: string;
  scoreNote: string;
  scoreFormula: string;
  closestProfile: string;
  referenceAverage: string;
  profileDifference: string;
  missingData: string;
  soilMissing: string;
  noRequirements: string;
  rainfallExcluded: string;
  openCrop: string;
  locationFallback: string;
  dateRangeWarning: string;
};

const WEATHER_EN: WeatherDict = {
  title: "Weather Prediction",
  subtitle: "Review the forecast for a selected location and day.",
  location: "Location",
  selectedLocation: "Selected location",
  coordinates: "Selected coordinates",
  selectedDate: "Select date",
  selectedDay: "Selected-day forecast",
  overview: "Weather overview",
  high: "High",
  low: "Low",
  condition: "Condition",
  rainChance: "Rain chance",
  precipitation: "Precipitation",
  sunrise: "Sunrise",
  sunset: "Sunset",
  humidity: "Mean humidity",
  wind: "Mean wind",
  feelsLike: "First hourly feels-like",
  temperature: "Temperature",
  hourlyForecast: "Hourly forecast",
  hourlyDescription: "Forecast values in the location's local time.",
  loading: "Loading weather…",
  loadingDescription: "Fetching the selected day's forecast.",
  unavailable: "Weather unavailable",
  requestFailed:
    "Could not load this forecast. Check your connection or choose another date or location.",
  retry: "Try again",
  empty: "No forecast data",
  emptyDescription: "Choose another date or location and try again.",
  cropTitle: "Weather profile comparisons",
  cropSubtitle:
    "A reference comparison for this location and forecast date—not a full crop recommendation.",
  profileScore: "Profile similarity score",
  scoreNote:
    "Scores compare forecast means with stored crop-model centroid values. The repository does not document how those centroids were derived; they are not verified crop requirements, agronomic suitability ratings, crop-success probabilities, or yield predictions.",
  scoreFormula:
    "Score = 100 / (1 + distance), with temperature and humidity differences scaled by the fallback's existing standard deviations (5 °C and 22.3 percentage points).",
  closestProfile: "Forecast averages compared with the stored profile",
  referenceAverage: "profile reference",
  profileDifference: "Difference",
  missingData: "Temperature and humidity data are needed for this comparison.",
  soilMissing:
    "Soil nutrients, pH, irrigation, season, and other field conditions are not included.",
  noRequirements:
    "Verified crop-specific favorable ranges and weather risks are unavailable, so this page does not label factors as favorable or limiting.",
  rainfallExcluded:
    "Rainfall is excluded because the crop training data does not document its rainfall period.",
  openCrop: "Open Crop Suggestion",
  locationFallback: "Selected coordinates",
  dateRangeWarning: "Forecast data may not be available for every date.",
};

const WEATHER_HI: WeatherDict = {
  title: "मौसम पूर्वानुमान",
  subtitle: "चुने हुए स्थान और दिन का पूर्वानुमान देखें।",
  location: "स्थान",
  selectedLocation: "चुना हुआ स्थान",
  coordinates: "चुने हुए निर्देशांक",
  selectedDate: "तारीख चुनें",
  selectedDay: "चुने हुए दिन का पूर्वानुमान",
  overview: "मौसम का सारांश",
  high: "अधिकतम",
  low: "न्यूनतम",
  condition: "स्थिति",
  rainChance: "बारिश की संभावना",
  precipitation: "वर्षा",
  sunrise: "सूर्योदय",
  sunset: "सूर्यास्त",
  humidity: "औसत आर्द्रता",
  wind: "औसत हवा",
  feelsLike: "पहले घंटे का अनुभूत तापमान",
  temperature: "तापमान",
  hourlyForecast: "घंटेवार पूर्वानुमान",
  hourlyDescription: "पूर्वानुमान मान स्थान के स्थानीय समय में हैं।",
  loading: "मौसम लोड हो रहा है…",
  loadingDescription: "चुने हुए दिन का पूर्वानुमान प्राप्त हो रहा है।",
  unavailable: "मौसम उपलब्ध नहीं",
  requestFailed:
    "यह पूर्वानुमान लोड नहीं हो सका। अपना कनेक्शन जाँचें या दूसरी तारीख अथवा स्थान चुनें।",
  retry: "फिर कोशिश करें",
  empty: "पूर्वानुमान डेटा उपलब्ध नहीं",
  emptyDescription: "दूसरी तारीख या स्थान चुनकर फिर कोशिश करें।",
  cropTitle: "मौसम प्रोफ़ाइल तुलना",
  cropSubtitle: "इस स्थान और पूर्वानुमान तारीख के लिए संदर्भ तुलना—पूर्ण फसल सिफारिश नहीं।",
  profileScore: "प्रोफ़ाइल समानता स्कोर",
  scoreNote:
    "स्कोर पूर्वानुमान के औसत की तुलना संग्रहीत फसल-मॉडल सेंट्रॉइड मानों से करते हैं। रिपॉज़िटरी में इन सेंट्रॉइड के बनने का तरीका दर्ज नहीं है; ये सत्यापित फसल आवश्यकताएँ, कृषि-उपयुक्तता रेटिंग, फसल-सफलता की संभावना या उपज का पूर्वानुमान नहीं हैं।",
  scoreFormula:
    "स्कोर = 100 / (1 + दूरी); तापमान और आर्द्रता के अंतर को फ़ॉलबैक के मौजूदा मानक-विचलन (5 °C और 22.3 प्रतिशत-बिंदु) से मापा जाता है।",
  closestProfile: "पूर्वानुमान औसत की संग्रहीत प्रोफ़ाइल से तुलना",
  referenceAverage: "प्रोफ़ाइल संदर्भ",
  profileDifference: "अंतर",
  missingData: "इस तुलना के लिए तापमान और आर्द्रता डेटा आवश्यक है।",
  soilMissing:
    "मिट्टी के पोषक तत्व, pH, सिंचाई, मौसम और खेत की अन्य स्थितियाँ इसमें शामिल नहीं हैं।",
  noRequirements:
    "फसल-विशिष्ट अनुकूल सीमाएँ और मौसम जोखिम सत्यापित नहीं हैं, इसलिए यहाँ कारकों को अनुकूल या सीमित करने वाला नहीं कहा जाता।",
  rainfallExcluded: "वर्षा शामिल नहीं है क्योंकि फसल प्रशिक्षण डेटा में उसकी अवधि दर्ज नहीं है।",
  openCrop: "फसल सुझाव खोलें",
  locationFallback: "चुने हुए निर्देशांक",
  dateRangeWarning: "हर तारीख के लिए पूर्वानुमान उपलब्ध होना सुनिश्चित नहीं है।",
};

const en: Dict = {
  brand: "TERRA·AI",
  brandSub: "Precision Agriculture",
  systemReady: "SYSTEM_READY.v2",
  nav: {
    disease: "Disease Detection",
    soil: "Soil Analysis",
    crop: "Crop Suggestion",
    weather: WEATHER_EN.title,
    advice: "Expert Advice",
  },
  weather: WEATHER_EN,
  disease: {
    title: "Plant Disease Detection",
    subtitle: "Upload a clear photo of the leaf surface for AI diagnosis.",
    workflowId: "AGRI-DIA-01",
    dropTitle: "Drop leaf photo here",
    dropHint: "JPEG or PNG up to 10 MB",
    select: "Select Photo",
    analyzing: "Analyzing…",
    result: "Detection Result",
    confidence: "Confidence",
    urgency: "Treatment Urgency",
    urgencyLow: "Low",
    urgencyMid: "Moderate",
    urgencyHigh: "High",
    action: "Recommended Action",
    reset: "New Scan",
    error: "Analysis failed. Check the backend is running.",
  },
  soil: {
    title: "Soil Analysis",
    subtitle: "Photograph the topsoil to classify texture and properties.",
    workflowId: "AGRI-SOIL-02",
    dropTitle: "Drop soil photo here",
    dropHint: "Image up to 10 MB",
    select: "Select Photo",
    analyzing: "Analyzing…",
    result: "Soil Class",
    confidence: "Confidence",
    properties: "Soil Properties",
    reset: "New Sample",
    error: "Analysis failed. Check the backend is running.",
    uploadGuidance:
      "For a clear photo, fill the frame with representative topsoil and use even natural light. Common formats such as JPEG, PNG, and WebP are accepted; maximum size is 10 MB.",
    emptyUpload: "The selected file is empty. Choose a readable soil photo.",
    tooLargeUpload: "The photo exceeds the 10 MB limit. Choose a smaller image.",
    modelScore: "Model score",
    notCalibrated: "not a calibrated probability",
    generalInfo: "General characteristics · not measured",
    otherScores: "Other model scores",
    disclaimerTitle: "Visual estimate only",
    disclaimerVisual:
      "This model classifies photos into four soil categories. Its softmax score is not a calibrated probability, and it does not measure this sample’s pH, nutrients, moisture, or other chemical properties.",
    disclaimerCrop:
      "Soil characteristics and crop suitability vary by location, season, irrigation, and the actual sample. Use a suitable soil test for measurements and treat crop suggestions as general guidance.",
  },
  crop: {
    title: "Crop Intelligence",
    subtitle: "Enter soil and climate measurements to compare the model's crop suggestions.",
    n: "Nitrogen (N; training unit unspecified)",
    p: "Phosphorus (P; training unit unspecified)",
    k: "Potassium (K; training unit unspecified)",
    temperature: "Temperature (°C)",
    humidity: "Humidity (%)",
    ph: "Soil pH Level",
    rainfall: "Rainfall (mm; period unspecified)",
    acidic: "0.0 ACIDIC",
    alkaline: "14.0 ALKALINE",
    submit: "Generate Recommendations",
    submitting: "Computing…",
    ranked: "Ranked suggestions",
    match: "Score",
    error: "Recommendation failed. Check the backend is running.",
    exampleDataNote:
      "The starting numbers are examples, not farm measurements. Replace them with your own readings before relying on the suggestions.",
    exampleResultWarning:
      "At least one field is still an example value; treat these results as a demonstration, not a field-specific recommendation.",
    recommended: "Recommended Crops",
    reset: "Reset to example values",
    exampleSource: "Example value",
    manualSource: "Manually entered",
    helpNutrients:
      "Use a soil laboratory report. The training CSV does not state N, P or K units; do not convert values based on this form.",
    helpTemperature: "Use a measured or representative air temperature in degrees Celsius.",
    helpHumidity: "Use relative humidity as a percentage.",
    helpPh: "Use a soil-test pH measurement; the soil image classifier does not measure pH.",
    helpRainfall:
      "Use a measured value in millimetres only if you know it matches the training data's period.",
    rainfallPeriodNote:
      "The training data lists rainfall in mm but does not document its time period. A current or daily weather value may not be comparable.",
    weatherNote:
      "Weather is not used to fill these fields. The weather view provides hourly/daily forecasts, not verified matching training periods or soil measurements.",
    required: "Enter a value.",
    invalidNumber: "Enter a finite number.",
    outOfRange: "Enter a value from {min} to {max}.",
    modelSource: "Recommendation method",
    catboostSource: "CatBoost trained model",
    fallbackSource: "Stored crop-profile fallback",
    unknownSource: "Method not reported by this server",
    modelScore: "Model class score",
    profileScore: "Profile similarity share",
    unknownScore: "Legacy score",
    scoreNoteCatboost:
      "This is the model's class score, not a calibrated probability that a crop will grow or yield successfully.",
    scoreNoteFallback:
      "This is the crop profile's share of the fallback similarity scores, not a probability of successful growth.",
    scoreNoteUnknown: "This older response does not identify how its score was calculated.",
    rank: "Rank",
    explanationCatboost:
      "Ranked by CatBoost across the seven submitted values; this model response does not identify which individual factors drove the rank.",
    explanationFallback:
      "Compared with stored crop centroids after scaling feature differences by the existing standard-deviation values; this does not establish agronomic suitability.",
    explanationUnknown: "The server did not provide enough information to explain this ranking.",
    factorsUnavailable:
      "Verified per-factor suitability ranges and explanations are not available in the current crop data.",
    tipLabel: "General crop tip",
    tipEnglish:
      "Crop names and tips are currently returned in English; translations are not available for this guidance.",
    inputWarnings: "Input notes",
    idleResults: "Enter your measurements and generate recommendations to see results here.",
    emptyResults: "The server returned no crop suggestions. Check your measurements and try again.",
    requestFailed: "Could not generate crop suggestions.",
    retry: "Try again",
  },
  advice: {
    title: "Expert Advice",
    subtitle: "Combine your scans for a personalized, streamed recommendation.",
    context: "Context assembled",
    noContext: "Run a Disease, Soil, or Crop workflow first to build context.",
    ask: "Ask the advisor",
    placeholder: "Add a question or leave blank for a general briefing…",
    streaming: "Streaming…",
    error: "Advice stream failed. Check the backend and API key.",
  },
};

const ta: Dict = {
  brand: "TERRA·AI",
  brandSub: "துல்லிய வேளாண்மை",
  systemReady: "கணினி_தயார்.v2",
  nav: {
    disease: "நோய் கண்டறிதல்",
    soil: "மண் பகுப்பாய்வு",
    crop: "பயிர் பரிந்துரை",
    weather: WEATHER_EN.title,
    advice: "நிபுணர் ஆலோசனை",
  },
  weather: WEATHER_EN,
  disease: {
    title: "தாவர நோய் கண்டறிதல்",
    subtitle: "இலையின் தெளிவான புகைப்படத்தை பதிவேற்றவும்.",
    workflowId: "AGRI-DIA-01",
    dropTitle: "இலை படத்தை இங்கே விடுங்கள்",
    dropHint: "JPEG அல்லது PNG, 10 MB வரை",
    select: "புகைப்படம் தேர்ந்தெடு",
    analyzing: "பகுப்பாய்வு…",
    result: "கண்டறிதல் முடிவு",
    confidence: "நம்பகத்தன்மை",
    urgency: "சிகிச்சை அவசரம்",
    urgencyLow: "குறைவு",
    urgencyMid: "நடுத்தரம்",
    urgencyHigh: "அதிகம்",
    action: "பரிந்துரைக்கப்பட்ட நடவடிக்கை",
    reset: "புதிய ஸ்கேன்",
    error: "பகுப்பாய்வு தோல்வி. பின்தள சேவையை சரிபார்க்கவும்.",
  },
  soil: {
    title: "மண் பகுப்பாய்வு",
    subtitle: "மண்ணின் மேற்பரப்பை புகைப்படம் எடுக்கவும்.",
    workflowId: "AGRI-SOIL-02",
    dropTitle: "மண் படத்தை இங்கே விடுங்கள்",
    dropHint: "படம், 10 MB வரை",
    select: "புகைப்படம் தேர்ந்தெடு",
    analyzing: "பகுப்பாய்வு…",
    result: "மண் வகை",
    confidence: "நம்பகத்தன்மை",
    properties: "மண் பண்புகள்",
    reset: "புதிய மாதிரி",
    error: "பகுப்பாய்வு தோல்வி.",
    uploadGuidance:
      "தெளிவான படத்திற்கு மேல்மண்ணை சட்டகத்தில் நிரப்பி, சமமான இயற்கை வெளிச்சத்தில் படம் எடுக்கவும். JPEG, PNG, WebP போன்ற பொதுவான வடிவங்கள் ஏற்கப்படும்; அதிகபட்சம் 10 MB.",
    emptyUpload:
      "தேர்ந்தெடுத்த கோப்பு காலியாக உள்ளது. படிக்கக்கூடிய மண் புகைப்படத்தைத் தேர்ந்தெடுக்கவும்.",
    tooLargeUpload: "புகைப்படம் 10 MB வரம்பை மீறுகிறது. சிறிய படத்தைத் தேர்ந்தெடுக்கவும்.",
    modelScore: "மாதிரி மதிப்பெண்",
    notCalibrated: "அளவுத்திருத்தப்பட்ட நிகழ்தகவு அல்ல",
    generalInfo: "பொதுவான பண்புகள் · அளவீடு அல்ல",
    otherScores: "மற்ற மாதிரி மதிப்பெண்கள்",
    disclaimerTitle: "காட்சி மதிப்பீடு மட்டுமே",
    disclaimerVisual:
      "இந்த மாதிரி படங்களை நான்கு மண் வகைகளாக வகைப்படுத்துகிறது. இதன் softmax மதிப்பெண் அளவுத்திருத்தப்பட்ட நிகழ்தகவு அல்ல; இந்த மாதிரி மண்ணின் pH, ஊட்டச்சத்துகள், ஈரப்பதம் அல்லது வேதியியல் பண்புகளை அளவிடாது.",
    disclaimerCrop:
      "மண் பண்புகளும் பயிர் பொருத்தமும் இடம், பருவம், பாசனம் மற்றும் உண்மையான மாதிரியைப் பொறுத்து மாறும். அளவீடுகளுக்கு மண் பரிசோதனை செய்து, பயிர் பரிந்துரைகளை பொதுவான வழிகாட்டுதலாகக் கருதவும்.",
  },
  crop: {
    title: "பயிர் நுண்ணறிவு",
    subtitle: "மாதிரியின் பயிர் பரிந்துரைகளை ஒப்பிட மண் மற்றும் காலநிலை அளவுகளை உள்ளிடவும்.",
    n: "நைட்ரஜன் (N; பயிற்சி அலகு குறிப்பிடப்படவில்லை)",
    p: "பாஸ்பரஸ் (P; பயிற்சி அலகு குறிப்பிடப்படவில்லை)",
    k: "பொட்டாசியம் (K; பயிற்சி அலகு குறிப்பிடப்படவில்லை)",
    temperature: "வெப்பநிலை (°C)",
    humidity: "ஈரப்பதம் (%)",
    ph: "மண் pH",
    rainfall: "மழை (mm; காலம் குறிப்பிடப்படவில்லை)",
    acidic: "0.0 அமிலம்",
    alkaline: "14.0 காரம்",
    submit: "பரிந்துரைகளை உருவாக்கு",
    submitting: "கணக்கிடுகிறது…",
    ranked: "தரவரிசைப்படுத்திய பரிந்துரைகள்",
    match: "மதிப்பெண்",
    error: "பரிந்துரை தோல்வி.",
    exampleDataNote:
      "தொடக்க எண்கள் எடுத்துக்காட்டுகள்; பண்ணை அளவீடுகள் அல்ல. பரிந்துரைகளை நம்புவதற்கு முன் உங்கள் அளவுகளைப் பயன்படுத்தவும்.",
    exampleResultWarning:
      "குறைந்தது ஒரு புலம் இன்னும் எடுத்துக்காட்டு மதிப்பாக உள்ளது; இதை விளக்கத்திற்கான முடிவாக மட்டும் கருதவும்.",
    recommended: "பரிந்துரைக்கப்பட்ட பயிர்கள்",
    reset: "எடுத்துக்காட்டு மதிப்புகளுக்கு மீட்டமை",
    exampleSource: "எடுத்துக்காட்டு மதிப்பு",
    manualSource: "கைமுறையாக உள்ளிடப்பட்டது",
    helpNutrients:
      "மண் ஆய்வக அறிக்கையைப் பயன்படுத்தவும். பயிற்சி CSV-யில் N, P, K அலகுகள் குறிப்பிடப்படவில்லை; இந்தப் படிவத்தின் அடிப்படையில் மாற்ற வேண்டாம்.",
    helpTemperature: "செல்சியஸில் அளந்த அல்லது பிரதிநிதித்துவமான காற்று வெப்பநிலையை உள்ளிடவும்.",
    helpHumidity: "சார்பு ஈரப்பதத்தை சதவீதமாக உள்ளிடவும்.",
    helpPh: "மண் பரிசோதனை pH-ஐப் பயன்படுத்தவும்; மண் பட வகைப்பான் pH-ஐ அளவிடாது.",
    helpRainfall:
      "பயிற்சித் தரவின் காலத்துடன் பொருந்தும் எனத் தெரிந்தால் மட்டுமே mm மதிப்பை உள்ளிடவும்.",
    rainfallPeriodNote:
      "பயிற்சித் தரவு மழையை mm-ல் குறிப்பிடுகிறது; கால அளவு இல்லை. தற்போதைய அல்லது தினசரி வானிலை மதிப்பு ஒப்பிடத்தக்கதாக இருக்காது.",
    weatherNote:
      "வானிலைத் தரவு இந்தப் புலங்களை நிரப்பாது. வானிலைப் பக்கம் மணிநேர/தினசரி முன்னறிவிப்பை வழங்குகிறது; பொருந்தும் பயிற்சிக் காலத்தையோ மண் அளவீடுகளையோ அல்ல.",
    required: "மதிப்பை உள்ளிடவும்.",
    invalidNumber: "வரையறுக்கப்பட்ட எண்ணை உள்ளிடவும்.",
    outOfRange: "{min} முதல் {max} வரையிலான மதிப்பை உள்ளிடவும்.",
    modelSource: "பரிந்துரை முறை",
    catboostSource: "CatBoost பயிற்சி மாதிரி",
    fallbackSource: "சேமித்த பயிர் சுயவிவர மாற்று",
    unknownSource: "சேவையகம் முறையைத் தெரிவிக்கவில்லை",
    modelScore: "மாதிரி வகுப்பு மதிப்பெண்",
    profileScore: "சுயவிவர ஒற்றுமைப் பங்கு",
    unknownScore: "பழைய மதிப்பெண்",
    scoreNoteCatboost:
      "இது மாதிரியின் வகுப்பு மதிப்பெண்; பயிர் வளரும் அல்லது விளைச்சல் கிடைக்கும் என்பதற்கான அளவுத்திருத்தப்பட்ட நிகழ்தகவு அல்ல.",
    scoreNoteFallback:
      "இது மாற்று ஒற்றுமை மதிப்பெண்களில் சுயவிவரத்தின் பங்கு; வெற்றிகரமான விளைச்சலுக்கான நிகழ்தகவு அல்ல.",
    scoreNoteUnknown: "இந்தப் பழைய பதிலில் மதிப்பெண் கணக்கிடப்பட்ட விதம் தெரிவிக்கப்படவில்லை.",
    rank: "வரிசை",
    explanationCatboost:
      "உள்ளிட்ட ஏழு மதிப்புகளின் அடிப்படையில் CatBoost வரிசைப்படுத்துகிறது; எந்தத் தனிப்பட்ட காரணி வரிசையை நிர்ணயித்தது என்பதைப் பதில் காட்டாது.",
    explanationFallback:
      "தற்போதுள்ள நிலையான விலகல் மதிப்புகளால் அம்ச வேறுபாடுகளை அளவிட்டு, சேமித்த பயிர் மையங்களுடன் ஒப்பிட்டது; இது வேளாண் பொருத்தத்தை உறுதி செய்யாது.",
    explanationUnknown: "இந்த வரிசையை விளக்க சேவையகம் போதிய தகவலை வழங்கவில்லை.",
    factorsUnavailable:
      "தற்போதைய பயிர் தரவில் சரிபார்க்கப்பட்ட காரணி-வாரியான பொருத்த வரம்புகளும் விளக்கங்களும் இல்லை.",
    tipLabel: "பொதுவான பயிர் குறிப்பு",
    tipEnglish:
      "பயிர் பெயர்களும் குறிப்புகளும் தற்போது ஆங்கிலத்தில் வருகின்றன; இந்த வழிகாட்டலுக்கு மொழிபெயர்ப்புகள் இல்லை.",
    inputWarnings: "உள்ளீட்டுக் குறிப்புகள்",
    idleResults: "முடிவுகளைக் காண அளவுகளை உள்ளிட்டு பரிந்துரைகளை உருவாக்கவும்.",
    emptyResults:
      "சேவையகம் பயிர் பரிந்துரைகளை வழங்கவில்லை. அளவுகளைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.",
    requestFailed: "பயிர் பரிந்துரைகளை உருவாக்க முடியவில்லை.",
    retry: "மீண்டும் முயற்சி",
  },
  advice: {
    title: "நிபுணர் ஆலோசனை",
    subtitle: "உங்கள் தரவை சேர்த்து தனிப்பயன் ஆலோசனை பெறுங்கள்.",
    context: "தொகுக்கப்பட்ட சூழல்",
    noContext: "முதலில் ஒரு பணிப்பாய்வை இயக்கவும்.",
    ask: "ஆலோசகரிடம் கேளுங்கள்",
    placeholder: "கேள்வியை சேர்க்கவும் அல்லது காலியாக விடவும்…",
    streaming: "ஸ்ட்ரீமிங்…",
    error: "ஆலோசனை தோல்வி.",
  },
};

const hi: Dict = {
  brand: "TERRA·AI",
  brandSub: "सटीक कृषि",
  systemReady: "सिस्टम_तैयार.v2",
  nav: {
    disease: "रोग पहचान",
    soil: "मिट्टी विश्लेषण",
    crop: "फसल सुझाव",
    weather: WEATHER_HI.title,
    advice: "विशेषज्ञ सलाह",
  },
  weather: WEATHER_HI,
  disease: {
    title: "पौध रोग पहचान",
    subtitle: "एआई निदान के लिए पत्ती की स्पष्ट तस्वीर अपलोड करें।",
    workflowId: "AGRI-DIA-01",
    dropTitle: "पत्ती की तस्वीर यहाँ छोड़ें",
    dropHint: "JPEG या PNG, 10 MB तक",
    select: "फोटो चुनें",
    analyzing: "विश्लेषण…",
    result: "निदान परिणाम",
    confidence: "विश्वास",
    urgency: "उपचार तात्कालिकता",
    urgencyLow: "कम",
    urgencyMid: "मध्यम",
    urgencyHigh: "उच्च",
    action: "अनुशंसित कार्रवाई",
    reset: "नई स्कैन",
    error: "विश्लेषण विफल। बैकएंड जांचें।",
  },
  soil: {
    title: "मिट्टी विश्लेषण",
    subtitle: "मिट्टी की सतह की तस्वीर लें।",
    workflowId: "AGRI-SOIL-02",
    dropTitle: "मिट्टी की तस्वीर यहाँ छोड़ें",
    dropHint: "छवि, 10 MB तक",
    select: "फोटो चुनें",
    analyzing: "विश्लेषण…",
    result: "मिट्टी वर्ग",
    confidence: "विश्वास",
    properties: "मिट्टी के गुण",
    reset: "नया नमूना",
    error: "विश्लेषण विफल।",
    uploadGuidance:
      "स्पष्ट तस्वीर के लिए ऊपर की मिट्टी को फ्रेम में भरें और समान प्राकृतिक रोशनी में फोटो लें। JPEG, PNG और WebP जैसे सामान्य प्रारूप स्वीकार किए जाते हैं; अधिकतम आकार 10 MB है।",
    emptyUpload: "चुनी गई फ़ाइल खाली है। पढ़ने योग्य मिट्टी की तस्वीर चुनें।",
    tooLargeUpload: "तस्वीर 10 MB सीमा से बड़ी है। छोटी छवि चुनें।",
    modelScore: "मॉडल स्कोर",
    notCalibrated: "कैलिब्रेटेड संभावना नहीं",
    generalInfo: "सामान्य विशेषताएँ · माप नहीं",
    otherScores: "अन्य मॉडल स्कोर",
    disclaimerTitle: "केवल दृश्य अनुमान",
    disclaimerVisual:
      "यह मॉडल तस्वीरों को चार मिट्टी श्रेणियों में वर्गीकृत करता है। इसका सॉफ्टमैक्स स्कोर कैलिब्रेटेड संभावना नहीं है और यह नमूने का pH, पोषक तत्व, नमी या अन्य रासायनिक गुण नहीं मापता।",
    disclaimerCrop:
      "मिट्टी के गुण और फसल की उपयुक्तता स्थान, मौसम, सिंचाई और वास्तविक नमूने पर निर्भर करते हैं। माप के लिए मिट्टी की जाँच कराएँ और फसल सुझावों को सामान्य मार्गदर्शन मानें।",
  },
  crop: {
    title: "फसल बुद्धिमत्ता",
    subtitle: "मॉडल के फसल सुझावों की तुलना के लिए मिट्टी और जलवायु के माप दर्ज करें।",
    n: "नाइट्रोजन (N; प्रशिक्षण इकाई अज्ञात)",
    p: "फास्फोरस (P; प्रशिक्षण इकाई अज्ञात)",
    k: "पोटैशियम (K; प्रशिक्षण इकाई अज्ञात)",
    temperature: "तापमान (°C)",
    humidity: "आर्द्रता (%)",
    ph: "मिट्टी pH",
    rainfall: "वर्षा (mm; अवधि अज्ञात)",
    acidic: "0.0 अम्लीय",
    alkaline: "14.0 क्षारीय",
    submit: "सिफारिशें बनाएँ",
    submitting: "गणना हो रही है…",
    ranked: "क्रमबद्ध सुझाव",
    match: "स्कोर",
    error: "सिफारिश विफल।",
    exampleDataNote:
      "शुरुआती संख्याएँ उदाहरण हैं, खेत के माप नहीं। सुझावों पर भरोसा करने से पहले इन्हें अपने माप से बदलें।",
    exampleResultWarning:
      "कम-से-कम एक फ़ील्ड अभी उदाहरण मान है; इन परिणामों को प्रदर्शन मानें, खेत-विशिष्ट सिफारिश नहीं।",
    recommended: "अनुशंसित फसलें",
    reset: "उदाहरण मान रीसेट करें",
    exampleSource: "उदाहरण मान",
    manualSource: "हाथ से दर्ज",
    helpNutrients:
      "मिट्टी प्रयोगशाला की रिपोर्ट देखें। प्रशिक्षण CSV में N, P या K की इकाई नहीं दी गई है; इस फ़ॉर्म के आधार पर मानों का रूपांतरण न करें।",
    helpTemperature: "डिग्री सेल्सियस में मापा गया या प्रतिनिधि वायु तापमान दर्ज करें।",
    helpHumidity: "सापेक्ष आर्द्रता प्रतिशत में दर्ज करें।",
    helpPh: "मिट्टी जाँच का pH उपयोग करें; मिट्टी की तस्वीर वाला वर्गीकरण pH नहीं मापता।",
    helpRainfall: "मिलीमीटर में मापा मान तभी दें जब उसकी अवधि प्रशिक्षण डेटा से मेल खाती हो।",
    rainfallPeriodNote:
      "प्रशिक्षण डेटा में वर्षा mm में है, लेकिन समय अवधि दर्ज नहीं है। वर्तमान या दैनिक मौसम मान तुलनीय न हो सकता है।",
    weatherNote:
      "इन फ़ील्ड को भरने के लिए मौसम डेटा उपयोग नहीं होता। मौसम दृश्य घंटे/दैनिक पूर्वानुमान देता है, सत्यापित प्रशिक्षण-अवधि या मिट्टी माप नहीं।",
    required: "मान दर्ज करें।",
    invalidNumber: "सीमित संख्या दर्ज करें।",
    outOfRange: "{min} से {max} के बीच मान दर्ज करें।",
    modelSource: "सिफारिश विधि",
    catboostSource: "CatBoost प्रशिक्षित मॉडल",
    fallbackSource: "संग्रहीत फसल-प्रोफ़ाइल फ़ॉलबैक",
    unknownSource: "इस सर्वर ने विधि नहीं बताई",
    modelScore: "मॉडल वर्ग स्कोर",
    profileScore: "प्रोफ़ाइल समानता का हिस्सा",
    unknownScore: "पुराना स्कोर",
    scoreNoteCatboost:
      "यह मॉडल का वर्ग स्कोर है; फसल उगने या उपज मिलने की कैलिब्रेटेड संभावना नहीं।",
    scoreNoteFallback:
      "यह फ़ॉलबैक समानता स्कोरों में फसल प्रोफ़ाइल का हिस्सा है; सफल खेती की संभावना नहीं।",
    scoreNoteUnknown: "इस पुराने उत्तर में स्कोर की गणना विधि नहीं बताई गई।",
    rank: "क्रम",
    explanationCatboost:
      "सात दर्ज मानों के आधार पर CatBoost ने क्रम दिया है; उत्तर यह नहीं बताता कि किन व्यक्तिगत कारकों ने क्रम तय किया।",
    explanationFallback:
      "मौजूदा मानक-विचलन से फ़ीचर अंतर को स्केल करके संग्रहीत फसल केंद्रों से तुलना की गई; यह कृषि उपयुक्तता प्रमाणित नहीं करता।",
    explanationUnknown: "सर्वर ने इस क्रम को समझाने के लिए पर्याप्त जानकारी नहीं दी।",
    factorsUnavailable:
      "मौजूदा फसल डेटा में सत्यापित प्रति-कारक उपयुक्तता सीमाएँ और स्पष्टीकरण उपलब्ध नहीं हैं।",
    tipLabel: "सामान्य फसल सुझाव",
    tipEnglish:
      "फसल के नाम और सुझाव अभी अंग्रेज़ी में लौटाए जाते हैं; इस मार्गदर्शन के अनुवाद उपलब्ध नहीं हैं।",
    inputWarnings: "इनपुट नोट",
    idleResults: "परिणाम देखने के लिए अपने माप दर्ज करके सिफारिशें बनाएँ।",
    emptyResults: "सर्वर ने कोई फसल सुझाव नहीं लौटाया। माप जाँचकर फिर प्रयास करें।",
    requestFailed: "फसल सुझाव नहीं बनाए जा सके।",
    retry: "फिर प्रयास करें",
  },
  advice: {
    title: "विशेषज्ञ सलाह",
    subtitle: "व्यक्तिगत सलाह के लिए अपने डेटा को संयोजित करें।",
    context: "संदर्भ तैयार",
    noContext: "पहले कोई वर्कफ़्लो चलाएँ।",
    ask: "सलाहकार से पूछें",
    placeholder: "प्रश्न जोड़ें या खाली छोड़ दें…",
    streaming: "स्ट्रीमिंग…",
    error: "सलाह विफल।",
  },
};

const te: Dict = {
  brand: "TERRA·AI",
  brandSub: "ఖచ్చిత వ్యవసాయం",
  systemReady: "సిస్టమ్_రెడీ.v2",
  nav: {
    disease: "వ్యాధి గుర్తింపు",
    soil: "నేల విశ్లేషణ",
    crop: "పంట సూచన",
    weather: WEATHER_EN.title,
    advice: "నిపుణుల సలహా",
  },
  weather: WEATHER_EN,
  disease: {
    title: "మొక్క వ్యాధి గుర్తింపు",
    subtitle: "AI నిర్ధారణ కోసం ఆకు ఫోటోను అప్‌లోడ్ చేయండి.",
    workflowId: "AGRI-DIA-01",
    dropTitle: "ఆకు ఫోటోను ఇక్కడ వదలండి",
    dropHint: "JPEG లేదా PNG, 10 MB వరకు",
    select: "ఫోటో ఎంచుకోండి",
    analyzing: "విశ్లేషిస్తోంది…",
    result: "గుర్తింపు ఫలితం",
    confidence: "విశ్వాసం",
    urgency: "చికిత్స అత్యవసరం",
    urgencyLow: "తక్కువ",
    urgencyMid: "మధ్యస్థం",
    urgencyHigh: "అధిక",
    action: "సిఫార్సు చేయబడిన చర్య",
    reset: "కొత్త స్కాన్",
    error: "విశ్లేషణ విఫలం.",
  },
  soil: {
    title: "నేల విశ్లేషణ",
    subtitle: "నేల ఉపరితలం ఫోటో తీయండి.",
    workflowId: "AGRI-SOIL-02",
    dropTitle: "నేల ఫోటోను ఇక్కడ వదలండి",
    dropHint: "చిత్రం, 10 MB వరకు",
    select: "ఫోటో ఎంచుకోండి",
    analyzing: "విశ్లేషిస్తోంది…",
    result: "నేల తరగతి",
    confidence: "విశ్వాసం",
    properties: "నేల లక్షణాలు",
    reset: "కొత్త నమూనా",
    error: "విశ్లేషణ విఫలం.",
    uploadGuidance:
      "స్పష్టమైన చిత్రం కోసం పైమట్టితో ఫ్రేమ్ నింపి, సమానమైన సహజ వెలుతురులో ఫోటో తీయండి. JPEG, PNG, WebP వంటి సాధారణ ఫార్మాట్‌లు అంగీకరించబడతాయి; గరిష్ఠ పరిమాణం 10 MB.",
    emptyUpload: "ఎంచుకున్న ఫైల్ ఖాళీగా ఉంది. చదవగలిగే నేల ఫోటోను ఎంచుకోండి.",
    tooLargeUpload: "ఫోటో 10 MB పరిమితిని మించింది. చిన్న చిత్రాన్ని ఎంచుకోండి.",
    modelScore: "మోడల్ స్కోరు",
    notCalibrated: "కాలిబ్రేట్ చేసిన సంభావ్యత కాదు",
    generalInfo: "సాధారణ లక్షణాలు · కొలతలు కావు",
    otherScores: "ఇతర మోడల్ స్కోర్లు",
    disclaimerTitle: "దృశ్య అంచనా మాత్రమే",
    disclaimerVisual:
      "ఈ మోడల్ ఫోటోలను నాలుగు నేల వర్గాలుగా వర్గీకరిస్తుంది. దీని softmax స్కోరు కాలిబ్రేట్ చేసిన సంభావ్యత కాదు; ఈ నమూనాలోని pH, పోషకాలు, తేమ లేదా ఇతర రసాయన లక్షణాలను ఇది కొలవదు.",
    disclaimerCrop:
      "నేల లక్షణాలు, పంట అనుకూలత ప్రాంతం, కాలం, నీటిపారుదల, నిజమైన నమూనాపై ఆధారపడి మారతాయి. కొలతల కోసం నేల పరీక్ష చేయించి, పంట సూచనలను సాధారణ మార్గదర్శకంగా పరిగణించండి.",
  },
  crop: {
    title: "పంట మేధస్సు",
    subtitle: "మోడల్ పంట సూచనలను పోల్చడానికి నేల, వాతావరణ కొలతలను నమోదు చేయండి.",
    n: "నత్రజని (N; శిక్షణ యూనిట్ పేర్కొనలేదు)",
    p: "భాస్వరం (P; శిక్షణ యూనిట్ పేర్కొనలేదు)",
    k: "పొటాషియం (K; శిక్షణ యూనిట్ పేర్కొనలేదు)",
    temperature: "ఉష్ణోగ్రత (°C)",
    humidity: "తేమ (%)",
    ph: "నేల pH",
    rainfall: "వర్షపాతం (mm; కాలవ్యవధి పేర్కొనలేదు)",
    acidic: "0.0 ఆమ్లం",
    alkaline: "14.0 క్షారం",
    submit: "సిఫార్సులను రూపొందించండి",
    submitting: "గణిస్తోంది…",
    ranked: "ర్యాంక్ చేసిన సూచనలు",
    match: "స్కోరు",
    error: "సిఫార్సు విఫలం.",
    exampleDataNote:
      "ప్రారంభ సంఖ్యలు ఉదాహరణలు మాత్రమే; పొలం కొలతలు కావు. సూచనలను నమ్మే ముందు మీ కొలతలతో మార్చండి.",
    exampleResultWarning:
      "కనీసం ఒక ఫీల్డ్ ఇంకా ఉదాహరణ విలువగానే ఉంది; ఈ ఫలితాలను ప్రదర్శనగా మాత్రమే పరిగణించండి.",
    recommended: "సిఫార్సు చేసిన పంటలు",
    reset: "ఉదాహరణ విలువలకు రీసెట్ చేయండి",
    exampleSource: "ఉదాహరణ విలువ",
    manualSource: "మీరు నమోదు చేసినది",
    helpNutrients:
      "నేల ప్రయోగశాల నివేదికను ఉపయోగించండి. శిక్షణ CSVలో N, P, K యూనిట్లు లేవు; ఈ ఫారమ్ ఆధారంగా విలువలను మార్చవద్దు.",
    helpTemperature: "సెల్సియస్‌లో కొలిచిన లేదా ప్రతినిధి గాలి ఉష్ణోగ్రతను నమోదు చేయండి.",
    helpHumidity: "సాపేక్ష ఆర్ద్రతను శాతంగా నమోదు చేయండి.",
    helpPh: "నేల పరీక్ష pHను ఉపయోగించండి; నేల చిత్ర వర్గీకరణ pHను కొలవదు.",
    helpRainfall:
      "శిక్షణ డేటా కాలవ్యవధికి సరిపోతుందని తెలిసినప్పుడు మాత్రమే mmలో విలువను నమోదు చేయండి.",
    rainfallPeriodNote:
      "శిక్షణ డేటాలో వర్షపాతం mmలో ఉంది; కాలవ్యవధి తెలియదు. ప్రస్తుత లేదా రోజువారీ వాతావరణ విలువ పోల్చదగినది కాకపోవచ్చు.",
    weatherNote:
      "వాతావరణ డేటా ఈ ఫీల్డ్‌లను నింపదు. వాతావరణ వీక్షణ గంట/రోజు అంచనాలను ఇస్తుంది; సరిపోలే శిక్షణ కాలం లేదా నేల కొలతలను కాదు.",
    required: "విలువను నమోదు చేయండి.",
    invalidNumber: "పరిమిత సంఖ్యను నమోదు చేయండి.",
    outOfRange: "{min} నుండి {max} మధ్య విలువను నమోదు చేయండి.",
    modelSource: "సిఫార్సు విధానం",
    catboostSource: "CatBoost శిక్షణ మోడల్",
    fallbackSource: "నిల్వ చేసిన పంట ప్రొఫైల్ ప్రత్యామ్నాయం",
    unknownSource: "ఈ సర్వర్ విధానాన్ని తెలియజేయలేదు",
    modelScore: "మోడల్ తరగతి స్కోరు",
    profileScore: "ప్రొఫైల్ సారూప్యత వాటా",
    unknownScore: "పాత స్కోరు",
    scoreNoteCatboost:
      "ఇది మోడల్ తరగతి స్కోరు మాత్రమే; పంట పెరుగుదల లేదా దిగుబడికి కాలిబ్రేట్ చేసిన సంభావ్యత కాదు.",
    scoreNoteFallback:
      "ఇది ప్రత్యామ్నాయ సారూప్యత స్కోర్లలో ప్రొఫైల్ వాటా మాత్రమే; విజయవంతమైన పంట సంభావ్యత కాదు.",
    scoreNoteUnknown: "ఈ పాత ప్రతిస్పందనలో స్కోరు ఎలా లెక్కించారో లేదు.",
    rank: "ర్యాంక్",
    explanationCatboost:
      "నమోదు చేసిన ఏడు విలువల ఆధారంగా CatBoost ర్యాంక్ ఇచ్చింది; ఏ వ్యక్తిగత అంశం ర్యాంక్‌పై ప్రభావం చూపిందో ప్రతిస్పందన తెలపదు.",
    explanationFallback:
      "ప్రస్తుత ప్రామాణిక విచలన విలువలతో ఫీచర్ తేడాలను స్కేల్ చేసి నిల్వ చేసిన పంట కేంద్రాలతో పోల్చారు; ఇది వ్యవసాయ అనుకూలతను నిర్ధారించదు.",
    explanationUnknown: "ఈ ర్యాంక్‌ను వివరించడానికి సర్వర్ తగిన సమాచారం ఇవ్వలేదు.",
    factorsUnavailable:
      "ప్రస్తుత పంట డేటాలో ధృవీకరించిన అంశాల వారీ అనుకూలత పరిమితులు, వివరణలు లేవు.",
    tipLabel: "సాధారణ పంట సూచన",
    tipEnglish: "పంట పేర్లు, సూచనలు ప్రస్తుతం ఆంగ్లంలో వస్తాయి; ఈ మార్గదర్శకానికి అనువాదాలు లేవు.",
    inputWarnings: "ఇన్‌పుట్ గమనికలు",
    idleResults: "ఫలితాలను చూడడానికి కొలతలను నమోదు చేసి సిఫార్సులను రూపొందించండి.",
    emptyResults: "సర్వర్ పంట సూచనలు ఇవ్వలేదు. కొలతలను తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.",
    requestFailed: "పంట సూచనలు రూపొందించలేకపోయాం.",
    retry: "మళ్లీ ప్రయత్నించండి",
  },
  advice: {
    title: "నిపుణుల సలహా",
    subtitle: "వ్యక్తిగత సలహా కోసం మీ డేటాను కలపండి.",
    context: "సందర్భం సిద్ధం",
    noContext: "మొదట ఒక వర్క్‌ఫ్లోను అమలు చేయండి.",
    ask: "సలహాదారుని అడగండి",
    placeholder: "ప్రశ్న జోడించండి లేదా ఖాళీగా ఉంచండి…",
    streaming: "స్ట్రీమింగ్…",
    error: "సలహా విఫలం.",
  },
};

export const TRANSLATIONS: Record<LangCode, Dict> = { en, hi };
