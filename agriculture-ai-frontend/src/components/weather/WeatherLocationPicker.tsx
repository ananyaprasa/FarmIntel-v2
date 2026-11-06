import { useEffect, useRef, useState } from "react";
import { MapPin, LocateFixed, Search } from "lucide-react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchWeatherPlaces, type WeatherPlace } from "@/lib/api";
import "./weather-location-picker.css";
import "leaflet/dist/leaflet.css";

export type WeatherLocation = {
  name?: string;
  latitude: number;
  longitude: number;
};

const WORLD_BOUNDS: L.LatLngBoundsExpression = [
  [-85, -180],
  [85, 180],
];

const WORLD_CENTER: L.LatLngExpression = [18, 0];

const selectedIcon = L.divIcon({
  className: "weather-location-marker",
  html: "<span></span>",
  iconSize: [28, 36],
  iconAnchor: [14, 34],
});

function formatCoordinates(location: WeatherLocation) {
  return `${location.latitude.toFixed(5)}°, ${location.longitude.toFixed(5)}°`;
}

function placeLabel(place: WeatherPlace) {
  return [place.name, place.admin1, place.country]
    .filter(
      (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index,
    )
    .join(", ");
}

function MapSelection({ onSelect }: { onSelect: (latitude: number, longitude: number) => void }) {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function MapFocus({ location }: { location: WeatherLocation | null }) {
  const map = useMap();

  useEffect(() => {
    if (location) {
      map.flyTo([location.latitude, location.longitude], Math.max(map.getZoom(), 6), {
        duration: 0.8,
      });
    }
  }, [location, map]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize({ pan: false });
    }, 250);
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
    });
    observer.observe(map.getContainer());

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [map]);

  return null;
}

export function WeatherLocationPicker({
  location,
  onConfirm,
}: {
  location: WeatherLocation;
  onConfirm: (location: WeatherLocation) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WeatherLocation | null>(null);
  const [mapFocus, setMapFocus] = useState<WeatherLocation | null>(null);
  const [query, setQuery] = useState("");
  const [searchRefresh, setSearchRefresh] = useState(0);
  const [places, setPlaces] = useState<WeatherPlace[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [locating, setLocating] = useState(false);
  const locationRequestId = useRef(0);

  useEffect(() => {
    const search = query.trim();
    if (!open || search.length < 2) {
      setPlaces([]);
      setSearchError("");
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    setPlaces([]);
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");
      try {
        const results = await searchWeatherPlaces(search, controller.signal);
        setPlaces(results);
      } catch (error) {
        if (!controller.signal.aborted) {
          setPlaces([]);
          setSearchError(
            error instanceof Error ? error.message : "Place search is temporarily unavailable.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 600);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, searchRefresh]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setDraft(location);
      setMapFocus(null);
      setQuery("");
      setPlaces([]);
      setSearchError("");
      setLocationError("");
    } else {
      locationRequestId.current += 1;
      setDraft(null);
      setLocating(false);
    }
  };

  const selectPlace = (place: WeatherPlace) => {
    const nextLocation = {
      name: placeLabel(place),
      latitude: place.latitude,
      longitude: place.longitude,
    };
    setDraft(nextLocation);
    setMapFocus(nextLocation);
    setPlaces([]);
    setQuery("");
    setLocationError("");
  };

  const useCurrentLocation = () => {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Location is not supported by this browser.");
      return;
    }

    const requestId = ++locationRequestId.current;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (requestId !== locationRequestId.current) return;
        const nextLocation = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        setDraft(nextLocation);
        setMapFocus(nextLocation);
        setLocating(false);
      },
      (error) => {
        if (requestId !== locationRequestId.current) return;
        const messages: Record<number, string> = {
          1: "Location permission was denied. You can still choose a point on the map.",
          2: "Your current location is unavailable. You can still choose a point on the map.",
          3: "Location request timed out. You can still choose a point on the map.",
        };
        setLocationError(
          messages[error.code] ??
            "Could not get your location. You can still choose a point on the map.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  };

  const confirmSelection = () => {
    if (!draft) return;
    onConfirm(draft);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-auto w-full justify-between rounded-2xl border-slate-200 bg-slate-50 px-4 py-3 text-left text-slate-900 shadow-none hover:bg-white"
          aria-label={`Change weather location. Current location: ${location.name ?? formatCoordinates(location)}`}
        >
          <span>
            <span className="block font-semibold">{location.name ?? "Selected coordinates"}</span>
            <span className="mt-1 block text-xs font-normal text-slate-500">
              {formatCoordinates(location)}
            </span>
          </span>
          <MapPin aria-hidden="true" className="text-emerald-700" />
        </Button>
      </DialogTrigger>

      <DialogContent className="flex h-[92dvh] max-h-[900px] w-[calc(100%-1rem)] max-w-6xl flex-col gap-0 overflow-hidden rounded-3xl border-0 bg-white p-0 sm:w-[calc(100%-3rem)]">
        <DialogHeader className="shrink-0 px-5 pb-3 pt-5 pr-14 text-left sm:px-7 sm:pt-7">
          <DialogTitle className="text-xl text-slate-900 sm:text-2xl">
            Choose your location
          </DialogTitle>
          <DialogDescription className="max-w-3xl leading-5">
            Explore the map, zoom into your area, and click to select where you want your weather
            forecast.
          </DialogDescription>
        </DialogHeader>

        <div className="relative z-20 shrink-0 px-5 pb-3 sm:px-7">
          <label
            htmlFor="weather-place-search"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Search for a city or place
          </label>
          <div className="flex gap-2">
            <Input
              id="weather-place-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try Bhilai or Chennai"
              maxLength={120}
              autoComplete="off"
              className="h-10 border-slate-200 bg-white"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10 shrink-0"
              aria-label="Search places"
              disabled={query.trim().length < 2 || searchLoading}
              onClick={() => setSearchRefresh((version) => version + 1)}
            >
              <Search aria-hidden="true" />
            </Button>
          </div>
          {(searchLoading || searchError || (query.trim().length >= 2 && !places.length)) && (
            <div
              className="absolute left-5 right-5 top-full z-[1000] mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:left-7 sm:right-7"
              role="status"
              aria-live="polite"
            >
              {searchLoading ? (
                <p className="px-4 py-3 text-sm text-slate-600">Searching places…</p>
              ) : searchError ? (
                <p className="px-4 py-3 text-sm text-red-700">{searchError}</p>
              ) : query.trim().length >= 2 ? (
                <p className="px-4 py-3 text-sm text-slate-600">No matching places found.</p>
              ) : null}
            </div>
          )}
          {places.length > 0 ? (
            <ul
              className="absolute left-5 right-5 top-full z-[1000] mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg sm:left-7 sm:right-7"
              aria-label="Matching places"
            >
              {places.map((place, index) => (
                <li key={`${place.latitude},${place.longitude},${index}`}>
                  <button
                    type="button"
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-800 hover:bg-emerald-50 focus-visible:bg-emerald-50 focus-visible:outline-none"
                    onClick={() => selectPlace(place)}
                  >
                    <span className="block font-medium">{place.name}</span>
                    <span className="text-xs text-slate-500">
                      {[place.admin1, place.country].filter(Boolean).join(", ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="weather-location-map-shell relative min-h-[220px] flex-1">
          <MapContainer
            center={WORLD_CENTER}
            zoom={2}
            minZoom={2}
            maxZoom={19}
            maxBounds={WORLD_BOUNDS}
            maxBoundsViscosity={1}
            worldCopyJump={false}
            className="weather-location-map"
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
              noWrap
            />
            <MapSelection
              onSelect={(latitude, longitude) => {
                setDraft({ latitude, longitude });
                setLocationError("");
              }}
            />
            <MapFocus location={mapFocus} />
            {draft ? (
              <Marker
                position={[draft.latitude, draft.longitude]}
                icon={selectedIcon}
                title="Selected weather location"
                alt="Selected weather location"
                keyboard
              />
            ) : null}
          </MapContainer>
          <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-xl border border-white/70 bg-white/95 px-3 py-2 shadow-sm">
            <p className="max-w-[70vw] truncate text-xs font-semibold text-slate-800">
              {draft?.name ?? "Selected map point"}
            </p>
            <p className="font-mono text-[11px] text-slate-600">
              {draft ? formatCoordinates(draft) : "Click the map to select"}
            </p>
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t border-slate-100 px-5 py-3 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0" aria-live="polite">
              <p className="truncate text-sm font-semibold text-slate-900">
                {draft?.name ?? "Coordinates selected"}
              </p>
              <p className="font-mono text-xs text-slate-500">
                {draft ? formatCoordinates(draft) : "Select a place on the map"}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={useCurrentLocation}
              disabled={locating}
            >
              <LocateFixed aria-hidden="true" />
              {locating ? "Locating…" : "Use my current location"}
            </Button>
          </div>
          {locationError ? (
            <p className="text-sm text-red-700" role="alert">
              {locationError}
            </p>
          ) : null}
          <p className="text-xs text-slate-500">Map data © OpenStreetMap contributors</p>
          <DialogFooter className="gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmSelection}
              disabled={!draft}
              className="bg-emerald-700 text-white hover:bg-emerald-800"
            >
              Use this location
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
