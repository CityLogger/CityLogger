"use client";

import {
  ArrowDown, ArrowLeft, ArrowUp, BookOpen, CalendarDays, Check, ChevronDown, Compass, Filter,
  GitCompareArrows, Globe2, GripVertical, Heart, ListFilter, ListPlus, Map as MapIcon, MapPin, MoreHorizontal,
  Pencil, Plus, Search, SlidersHorizontal, Sparkles, Star, Trophy, UserRound, X
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addWishlistCity, createPersonalList, createVisit, deletePersonalList, deleteVisit, downloadAccountData, loadAppState,
  loadVisits, removeWishlistCity, renamePersonalList, savePersonalListCities, saveRankingOrder, saveWishlistOrder, saveYearlyGoal as saveStoredYearlyGoal,
  updateVisit, type StoredCity
} from "../backend/index";
import { authRedirectUrl, isSupabaseConfigured, supabase } from "../backend/supabase";
import Onboarding, { type EntryStage } from "./Onboarding";
import { cleanEmailOtpInput, emailOtpLength } from "./emailVerification";
import { JournalOperations } from "./journalOperations";
import { canonicalRanking, reorderVisible } from "./rankingOrder";
import { guestTransferId, verifyGuestTransfer } from "./guestTransfer";
import { cityIdentity, latestCities, newestVisits, visitMonth, visitSortDate, visitHistory, GUEST_KEY, ONBOARDING_KEY } from "./journey";

type RatingKey = "personal" | "culture" | "architecture" | "food" | "nature" | "nightlife";
type Ratings = Record<RatingKey, number | null>;
type CityId = number | string;

type City = {
  geonameId?: string | null;
  id: CityId; name: string; country: string; continent: string; lat: number; lng: number;
  rating: number; ratings: Ratings; dateFrom: string; dateTo: string;
  visitType: string; note: string; emoji: string; photoUrl?: string; createdAt?: string;
};

type CityOption = {
  geonameId?: string | null;
  id?: string;
  name: string; ascii?: string; country: string; continent: string;
  lat: number; lng: number; emoji: string; population?: number;
};

type PersonalList = { id: CityId; title: string; cityIds: CityId[] };

const suggestions: CityOption[] = [
  { name: "Barcelona", country: "Spain", continent: "Europe", lat: 41.39, lng: 2.17, emoji: "🇪🇸" },
  { name: "Buenos Aires", country: "Argentina", continent: "South America", lat: -34.6, lng: -58.38, emoji: "🇦🇷" },
  { name: "Copenhagen", country: "Denmark", continent: "Europe", lat: 55.68, lng: 12.57, emoji: "🇩🇰" },
  { name: "Melbourne", country: "Australia", continent: "Oceania", lat: -37.81, lng: 144.96, emoji: "🇦🇺" },
  { name: "Seoul", country: "South Korea", continent: "Asia", lat: 37.57, lng: 126.98, emoji: "🇰🇷" }
];

const categories = ["Overall", "Personal", "Culture", "Architecture", "Food", "Nature", "Nightlife"];
const requiredRatingKeys: RatingKey[] = ["personal", "culture", "architecture", "food"];
const optionalRatingKeys: RatingKey[] = ["nature", "nightlife"];
const reviewAccountEmail = "appreview@citylogger.test";
const pendingSignupEmailKey = "citylog-pending-signup-email";
const guestNoticeKey = (userId: string) => `citylog-guest-notice-dismissed-${userId}`;
const readPendingSignupEmail = () => {
  try { return window.localStorage.getItem(pendingSignupEmailKey); } catch { return null; }
};
const savePendingSignupEmail = (email: string) => {
  try { window.localStorage.setItem(pendingSignupEmailKey, email); } catch { /* Verification can continue in memory. */ }
};
const clearPendingSignupEmail = () => {
  try { window.localStorage.removeItem(pendingSignupEmailKey); } catch { /* No persistent state to clear. */ }
};
const colorForScore = (score: number) =>
  score > 4.5 ? "#236844" :
  score > 4 ? "#62A461" :
  score > 3 ? "#D4B849" :
  score > 2 ? "#E28A43" : "#CD554F";
const scoreFor = (city: City, category: string) =>
  category === "Overall" ? city.rating : city.ratings[category.toLowerCase() as RatingKey];
const calculateOverall = (ratings: Ratings) => {
  const values = Object.values(ratings).filter((value): value is number => value !== null && value > 0);
  return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : 0;
};
const formatVisitDate = (from: string, to: string) => {
  const formatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (!from && !to) return "Dates not added";
  if (!from) return `Left ${formatter.format(new Date(`${to}T12:00:00`))}`;
  const start = formatter.format(new Date(`${from}T12:00:00`));
  if (!to) return `Arrived ${start}`;
  if (to === from) return start;
  return `${start} – ${formatter.format(new Date(`${to}T12:00:00`))}`;
};
const normalizeSearch = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const escapeMapText = (value: string) => value.replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]!));
const countryFlag = (code: string) => code.length === 2
  ? String.fromCodePoint(...code.toUpperCase().split("").map(char => 127397 + char.charCodeAt(0)))
  : "🌍";

function FlagMark({ emoji, country, className = "" }: { emoji: string; country: string; className?: string }) {
  const points = [...emoji].map(char => char.codePointAt(0) || 0);
  const code = points.length === 2 && points.every(point => point >= 0x1f1e6 && point <= 0x1f1ff)
    ? points.map(point => String.fromCharCode(point - 0x1f1e6 + 97)).join("")
    : "";
  return <span className={`flag-mark ${className}`} role="img" aria-label={code ? `${country} flag` : country}>{code ? <img src={`/flags/${code}.svg`} alt="" loading="lazy"/> : <Globe2 aria-hidden="true"/>}</span>;
}

function CategoryRating({
  label,
  value,
  optional = false,
  onChange
}: {
  label: string;
  value: number | null;
  optional?: boolean;
  onChange: (value: number | null) => void;
}) {
  if (optional && value === null) {
    return (
      <div className="category-rating optional-empty">
        <span><strong>{label}</strong><small>Optional</small></span>
        <button type="button" onClick={() => onChange(3.5)}>+ Add rating</button>
      </div>
    );
  }

  return (
    <label className="category-rating">
      <span><strong>{label}</strong>{optional && <button type="button" onClick={() => onChange(null)}>Remove</button>}</span>
      <div>
        <input
          type="range"
          min="1"
          max="5"
          step="0.5"
          value={value || 1}
          onChange={event => onChange(Number(event.target.value))}
          aria-label={`${label} rating`}
        />
        <output style={{ background: colorForScore(value || 1) }}>{(value || 1).toFixed(1)}</output>
      </div>
    </label>
  );
}

function InteractiveMap({
  cities,
  wishlist,
  selected,
  onSelect,
  scoreCategory
}: {
  cities: City[];
  wishlist: CityOption[];
  selected: City | null;
  onSelect: (city: City | null) => void;
  scoreCategory: string;
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("leaflet").Map | null>(null);
  const markerLayer = useRef<import("leaflet").LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function createMap() {
      if (!mapElement.current || mapInstance.current) return;
      const L = await import("leaflet");
      if (cancelled || !mapElement.current) return;

      const map = L.map(mapElement.current, {
        center: selected ? [selected.lat, selected.lng] : [22, 8],
        zoom: selected ? 6 : 2,
        minZoom: 2,
        maxZoom: 18,
        zoomControl: false,
        markerZoomAnimation: false,
        worldCopyJump: true,
        preferCanvas: true
      });

      L.control.zoom({ position: "topright" }).addTo(map);
      const cartoKey = process.env.NEXT_PUBLIC_CARTO_BASEMAP_API_KEY;
      const osmTiles = () => L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      });
      if (cartoKey) {
        mapElement.current.dataset.basemap = "positron";
        const positronTiles = L.tileLayer(
          `https://basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png?key=${encodeURIComponent(cartoKey)}`,
          {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attribution/">CARTO</a>',
            maxZoom: 20
          }
        ).addTo(map);
        let tileErrors = 0;
        positronTiles.on("tileerror", () => {
          if (++tileErrors < 3 || !mapElement.current) return;
          map.removeLayer(positronTiles);
          mapElement.current.dataset.basemap = "osm";
          osmTiles().addTo(map);
        });
      } else {
        mapElement.current.dataset.basemap = "osm";
        osmTiles().addTo(map);
      }

      const layer = L.layerGroup().addTo(map);
      mapInstance.current = map;
      markerLayer.current = layer;

      const updateZoomDetail = () => {
        if (mapElement.current) {
          const zoom = map.getZoom();
          mapElement.current.dataset.cityZoom = zoom >= 8 ? "true" : "false";
          mapElement.current.dataset.markerScale = zoom <= 3 ? "world" : zoom <= 5 ? "regional" : zoom <= 7 ? "local" : "street";
        }
      };
      map.on("zoomend", updateZoomDetail);
      map.on("click", () => onSelect(null));
      updateZoomDetail();
    }

    createMap();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout>;

    async function drawMarkers() {
      if (cancelled) return;
      const map = mapInstance.current;
      const layer = markerLayer.current;
      if (!map || !layer) {
        retry = setTimeout(drawMarkers, 40);
        return;
      }

      const L = await import("leaflet");
      if (cancelled) return;
      layer.clearLayers();

      cities.forEach(city => {
        const isSelected = selected?.id === city.id;
        const displayScore = scoreFor(city, scoreCategory);
        if (displayScore === null) return;
        const icon = L.divIcon({
          className: "city-div-icon",
          html: `<div class="city-map-marker${isSelected ? " is-selected" : ""}" style="--marker-color:${colorForScore(displayScore)}">
            <span class="city-marker-label">${escapeMapText(city.name)}</span>
          </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        const marker = L.marker([city.lat, city.lng], {
          icon,
          title: `${city.name}, ${displayScore.toFixed(1)} stars`,
          riseOnHover: true
        }).addTo(layer);

        marker.bindTooltip(
          `<strong>${escapeMapText(city.name)}</strong><br>${escapeMapText(city.country)} · ${displayScore.toFixed(1)}/5 ${scoreCategory.toLowerCase()}`,
          { direction: "top", offset: [0, -18], className: "city-tooltip" }
        );
        marker.on("click", () => {
          onSelect(city);
          if (map.getZoom() < 6) map.flyTo([city.lat, city.lng], 6, { duration: 0.8 });
        });
      });

      wishlist.forEach(city => {
        const icon = L.divIcon({
          className: "city-div-icon",
          html: `<div class="city-map-marker wishlist-marker"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 27.5 4.8 16.7C-1.1 10.9 3.3 2.7 10.1 3.2c2.6.2 4.7 1.6 5.9 3.8 1.2-2.2 3.3-3.6 5.9-3.8 6.8-.5 11.2 7.7 5.3 13.5L16 27.5Z"/></svg><span class="city-marker-label">${escapeMapText(city.name)}</span></div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });
        L.marker([city.lat, city.lng], { icon, title: city.name, riseOnHover: true })
          .bindTooltip(`<strong>${escapeMapText(city.name)}</strong><br>${escapeMapText(city.country)}`, { direction: "top", offset: [0, -13], className: "city-tooltip" })
          .addTo(layer);
      });
    }

    drawMarkers();
    return () => { cancelled = true; clearTimeout(retry); };
  }, [cities, wishlist, selected, onSelect, scoreCategory]);

  useEffect(() => () => {
    mapInstance.current?.remove();
    mapInstance.current = null;
  }, []);

  return <div ref={mapElement} className="leaflet-map" aria-label="Interactive map of your rated cities" />;
}

export default function CityLogger({ nativeMode = false }: { nativeMode?: boolean }) {
  const [tab, setTab] = useState<"map" | "rankings" | "log" | "compare" | "lists" | "profile" | "city">("map");
  const [cityReturnTab, setCityReturnTab] = useState<"map" | "rankings" | "log">("map");
  const [cities, setCities] = useState<City[]>([]);
  const [selected, setSelected] = useState<City | null>(null);
  const [entryStage, setEntryStage] = useState<EntryStage>("loading");
  const [onboardingNotice, setOnboardingNotice] = useState("");
  const [guestReady, setGuestReady] = useState(false);
  const [guestImportAvailable, setGuestImportAvailable] = useState(false);
  const [guestNoticeDismissed, setGuestNoticeDismissed] = useState(false);
  const [guestImportError, setGuestImportError] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [guestStorageError, setGuestStorageError] = useState("");
  const signupPending = useRef(false);
  const entryInitialised = useRef(false);
  const visitOperationId = useRef<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [editorReturnTab, setEditorReturnTab] = useState<"map" | "city">("map");
  const [query, setQuery] = useState("");
  const [candidate, setCandidate] = useState<CityOption | null>(null);
  const [searchResults, setSearchResults] = useState<CityOption[]>(suggestions);
  const [searching, setSearching] = useState(false);
  const [ratings, setRatings] = useState<Ratings>({ personal: 4, culture: 4, architecture: 4, food: 4, nature: null, nightlife: null });
  const [personalOnly, setPersonalOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [visitType, setVisitType] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("Overall");
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [continent, setContinent] = useState("All");
  const [wishlist, setWishlist] = useState<CityOption[]>([]);
  const [showAllWishlist, setShowAllWishlist] = useState(false);
  const [manualOrder, setManualOrder] = useState<CityId[] | null>(null);
  const [draggedCity, setDraggedCity] = useState<CityId | null>(null);
  const [rankEditMode, setRankEditMode] = useState(false);
  const [wishlistEditMode, setWishlistEditMode] = useState(false);
  const [compareIds, setCompareIds] = useState<[CityId, CityId]>(["", ""]);
  const [lists, setLists] = useState<PersonalList[]>([]);
  const [newListTitle, setNewListTitle] = useState("");
  const [editingListId, setEditingListId] = useState<CityId | null>(null);
  const [listTitleDraft, setListTitleDraft] = useState("");
  const [listEditError, setListEditError] = useState("");
  const [listBusy, setListBusy] = useState(false);
  const [yearlyGoal, setYearlyGoal] = useState(10);
  const [goalDraft, setGoalDraft] = useState("10");
  const [editingGoal, setEditingGoal] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<"welcome" | "signin" | "signup" | "verify" | "forgot" | "reset">("welcome");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [profileName, setProfileName] = useState("Your travel journal");
  const [syncStatus, setSyncStatus] = useState<"idle" | "loading" | "saved" | "error">("idle");
  const [loadError, setLoadError] = useState("");
  const [cleanupWarning, setCleanupWarning] = useState("");
  const [loadRetry, setLoadRetry] = useState(0);
  const loadedUserId = useRef<string | null>(null);
  const syncRequest = useRef(0);
  const journalOperations = useRef(new JournalOperations());
  const publicPageUrl = (path: string) => nativeMode ? `https://citylogger.app${path}` : path;
  const citySummaries = useMemo(() => latestCities(cities), [cities]);
  const storyHistory = useMemo(() => selected ? visitHistory(cities, selected) : [], [cities, selected]);
  const currentCity = storyHistory[0] || selected;

  const mapCities = useMemo(() => citySummaries.filter(city => scoreFor(city, category) !== null), [citySummaries, category]);
  const filtered = useMemo(() => mapCities.filter(city => continent === "All" || city.continent === continent), [mapCities, continent]);

  const ranked = useMemo(() => [...filtered].sort((a, b) =>
    (scoreFor(b, category) || 0) - (scoreFor(a, category) || 0) ||
    visitSortDate(b).localeCompare(visitSortDate(a)) ||
    a.name.localeCompare(b.name)
  ), [filtered, category]);
  const chronological = useMemo(() => newestVisits(cities), [cities]);
  const datedVisits = chronological.filter(city => city.dateFrom || city.dateTo);
  const undatedVisits = chronological.filter(city => !city.dateFrom && !city.dateTo);
  const fullRanking = useMemo(() => canonicalRanking(cities, manualOrder), [cities, manualOrder]);
  const rankingId = (city: City) => fullRanking.find(id => visitHistory(cities, city).some(visit => visit.id === id)) ?? city.id;
  const displayedRanked = useMemo(() => {
    if (!manualOrder) return ranked;
    const positions = new Map(fullRanking.map((id, index) => [id, index]));
    const position = (city: City) => Math.min(...visitHistory(cities, city).map(visit => positions.get(visit.id) ?? Number.MAX_SAFE_INTEGER));
    return [...ranked].sort((a, b) => position(a) - position(b));
  }, [ranked, manualOrder, cities, fullRanking]);
  const firstCompared = citySummaries.find(city => String(city.id) === String(compareIds[0])) || citySummaries[0];
  const secondCompared = citySummaries.find(city => String(city.id) === String(compareIds[1]) && city.id !== firstCompared?.id)
    || citySummaries.find(city => city.id !== firstCompared?.id);
  const compared = [firstCompared, secondCompared].filter((city): city is City => Boolean(city));
  const draftRatings: Ratings = personalOnly ? {personal:ratings.personal,culture:null,architecture:null,food:null,nature:null,nightlife:null} : ratings;
  const draftOverall = calculateOverall(draftRatings);
  const requiredRatingsComplete = (personalOnly ? ["personal"] as RatingKey[] : requiredRatingKeys).every(key => ratings[key] !== null && (ratings[key] || 0) > 0);
  const invalidDateRange = Boolean(dateFrom && dateTo && dateTo < dateFrom);
  const currentYear = new Date().getFullYear();
  const citiesThisYear = new Set(cities.filter(city => city.dateFrom.startsWith(`${currentYear}-`)).map(cityIdentity)).size;
  const goalProgress = Math.min(100, Math.round((citiesThisYear / yearlyGoal) * 100));

  useEffect(() => {
    if (nativeMode) window.scrollTo({ top: 0, behavior: "instant" });
  }, [tab, nativeMode]);

  useEffect(() => {
    if (tab !== "rankings") setRankEditMode(false);
    if (tab !== "lists") { setWishlistEditMode(false); setEditingListId(null); }
  }, [tab]);

  useEffect(() => {
    if (!categoryMenuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!categoryMenuRef.current?.contains(event.target as Node)) setCategoryMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setCategoryMenuOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutsidePress); document.removeEventListener("keydown", closeOnEscape); };
  }, [categoryMenuOpen]);

  function restoreGuest() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(GUEST_KEY) || "null");
      setCities(Array.isArray(saved?.cities) ? saved.cities : []);
      setWishlist(Array.isArray(saved?.wishlist) ? saved.wishlist : []);
      setLists(Array.isArray(saved?.lists) ? saved.lists : []);
      setManualOrder(Array.isArray(saved?.manualOrder) ? saved.manualOrder : null);
      const goal = Math.max(1, Math.min(999, Number(saved?.yearlyGoal ?? localStorage.getItem("citylogger-yearly-goal-v2")) || 10));
      setYearlyGoal(goal); setGoalDraft(String(goal));
    } catch { setCities([]); setWishlist([]); setLists([]); setManualOrder(null); }
    setSelected(null);
    setProfileName("Your travel journal");
    setGuestReady(true);
  }

  useEffect(() => {
    if (!authReady || entryInitialised.current) return;
    entryInitialised.current = true;
    if (!user) restoreGuest();
    let complete = false;
    try { complete = window.localStorage.getItem(ONBOARDING_KEY) === "complete"; } catch { /* Storage can be unavailable in private browsing. */ }
    setEntryStage(user || complete ? "done" : "welcome");
  }, [authReady, user]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (user) {
      if (!signupPending.current) setEntryStage("done");
      try { const guest = JSON.parse(localStorage.getItem(GUEST_KEY) || "null"); setGuestImportAvailable(Boolean(guest?.cities?.length || guest?.wishlist?.length || guest?.lists?.length)); } catch { setGuestImportAvailable(false); }
      try { setGuestNoticeDismissed(localStorage.getItem(guestNoticeKey(user.id)) === "true"); } catch { setGuestNoticeDismissed(false); }
    }
  }, [user?.id]);

  function dismissGuestNotice() {
    setGuestNoticeDismissed(true);
    if (user) try { localStorage.setItem(guestNoticeKey(user.id), "true"); } catch { /* Dismissal still works for this session. */ }
  }

  useEffect(() => {
    if (!guestReady || !authReady || user) return;
    try { localStorage.setItem(GUEST_KEY, JSON.stringify({cities,wishlist,lists,manualOrder,yearlyGoal})); setGuestStorageError(""); }
    catch { setGuestStorageError("Your device could not save this journal. Keep this window open and free up storage before trying again."); setSyncStatus("error"); }
  }, [cities,wishlist,lists,manualOrder,yearlyGoal,guestReady,authReady,user]);

  function finishOnboarding() {
    try { localStorage.setItem(ONBOARDING_KEY,"complete"); } catch { /* The session still works without browser storage. */ }
    signupPending.current = false;
    setEntryStage("done"); setTab("map");
  }

  function enterGuest() {
    try { if (localStorage.getItem(ONBOARDING_KEY) === "complete") { finishOnboarding(); return; } } catch { /* Continue without persistent preferences. */ }
    setEntryStage("cards");
  }

  async function runJournalMutation<T>(work: (isCurrent: () => boolean) => Promise<T>, commit: (value: T) => void, onError?: (error: unknown) => void) {
    if (user && syncStatus === "loading" && !journalOperations.current.busy) {
      setLoadError("Your journal is still loading. Please wait before making changes.");
      return false;
    }
    const operation = journalOperations.current.begin(user?.id || null);
    if (!operation) {
      setLoadError("A change is still saving. Please wait before making another change.");
      return false;
    }
    ++syncRequest.current;
    setSyncStatus("loading");
    setSaveBusy(true);
    setListBusy(true);
    setLoadError("");
    try {
      const value = await work(operation.isCurrent);
      if (!operation.isCurrent()) return false;
      commit(value);
      setSyncStatus("saved");
      return true;
    } catch (error) {
      if (operation.isCurrent()) {
        setSyncStatus("error");
        setLoadError("This change could not be saved. Your last saved data is still available. Please retry.");
        onError?.(error);
      }
      return false;
    } finally {
      if (operation.isCurrent()) { setSaveBusy(false); setListBusy(false); }
      operation.finish();
    }
  }

  async function importGuestJournal() {
    if (!user || saveBusy) return;
    setGuestImportError("");
    const guestSnapshot = localStorage.getItem(GUEST_KEY);
      await runJournalMutation(async isCurrent => {
        const check = () => { if (!isCurrent()) throw new Error("Account changed."); };
        const guest = JSON.parse(guestSnapshot || "null") as { cities: City[]; wishlist: CityOption[]; lists: PersonalList[]; manualOrder: CityId[] | null; yearlyGoal: number } | null;
        if (!guest) return null;
        const [existingVisits, existingState] = await Promise.all([loadVisits(user.id), loadAppState(user.id)]);
        check();
        const visitIds = new Set(existingVisits.map(visit => visit.id));
        const idMap = new Map<string, string>();
        // Save the goal first: a retry after partial visit insertion must not lose it.
        if (!existingVisits.length) await saveStoredYearlyGoal(guest.yearlyGoal || 10, user.id);
        for (const visit of guest.cities || []) {
          check();
          const id = visitIds.has(String(visit.id)) ? String(visit.id) : await guestTransferId(user.id, "visit", visit.id);
          idMap.set(String(visit.id), id);
          check();
          if (!visitIds.has(id)) { await createVisit(visit as StoredCity, id, user.id); visitIds.add(id); }
        }
        const importedWishlist = [...existingState.wishlist];
        for (const city of guest.wishlist || []) {
          check();
          if (!importedWishlist.some(item => cityIdentity(item) === cityIdentity(city))) importedWishlist.push(await addWishlistCity(city, user.id));
        }
        check();
        if (importedWishlist.length) await saveWishlistOrder(importedWishlist.map(city => city.id), user.id);
        const transferredLists: {id: string; cityIds: string[]}[] = [];
        for (const [index, list] of (guest.lists || []).entries()) {
          check();
          const id = existingState.lists.some(item => item.id === String(list.id)) ? String(list.id) : await guestTransferId(user.id, "list", list.id);
          check();
          const existing = existingState.lists.find(item => item.id === id);
          if (!existing) await createPersonalList(list.title, existingState.lists.length + index, id, user.id);
          check();
          const cityIds = [...new Set([...(existing?.cityIds || []), ...list.cityIds.map(id => idMap.get(String(id))).filter((id): id is string => Boolean(id))])];
          await savePersonalListCities(id, cityIds, user.id);
          transferredLists.push({id, cityIds});
        }
        check();
        const ranking = [...new Set([...existingState.rankingOrder, ...(guest.manualOrder || []).map(id => idMap.get(String(id))).filter((id): id is string => Boolean(id))])];
        if (ranking.length) await saveRankingOrder(ranking, user.id);
        check();
        const result = await Promise.all([loadVisits(user.id), loadAppState(user.id)]);
        check();
        verifyGuestTransfer({visits:[...idMap.values()], lists:transferredLists, wishlist:importedWishlist.map(city => city.id), ranking}, result[0], result[1]);
        return result;
      }, result => {
        if (!result) return;
        const [stored, state] = result;
        setCities(stored); setWishlist(state.wishlist); setLists(state.lists);
        setManualOrder(state.rankingOrder.length ? state.rankingOrder : null);
        setYearlyGoal(state.yearlyGoal); setGoalDraft(String(state.yearlyGoal));
        if (localStorage.getItem(GUEST_KEY) === guestSnapshot) {
          localStorage.removeItem(GUEST_KEY); setGuestImportAvailable(false);
        } else {
          setGuestImportError("Your guest journal changed during transfer. Import again to include the new entries.");
        }
      }, () => setGuestImportError("We couldn't move your guest data yet. It is still on this device; please try again."));
  }
  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      journalOperations.current.setOwner(data.session?.user.id || null);
      setUser(data.session?.user || null);
      setAuthReady(true);
      const pendingEmail = readPendingSignupEmail();
      if (!data.session && pendingEmail) {
        signupPending.current = true;
        setAuthEmail(pendingEmail);
        setAuthView("verify");
        setAuthOpen(true);
      } else if (data.session && pendingEmail) {
        clearPendingSignupEmail();
      }
      if (window.sessionStorage.getItem("citylogger-password-recovery") === "true") {
        window.sessionStorage.removeItem("citylogger-password-recovery");
        setAuthView("reset");
        setAuthOpen(true);
      }
    }).catch(() => { setAuthReady(true); setAuthMessage("We couldn’t restore your session. Please sign in again."); });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      journalOperations.current.setOwner(session?.user.id || null);
      if (event === "SIGNED_OUT") { setAdding(false); setCandidate(null); setEditingVisitId(null); setSaveBusy(false); setListBusy(false); }
      setUser(session?.user || null);
      if (event === "PASSWORD_RECOVERY") {
        setAuthView("reset");
        setAuthOpen(true);
      }
      if (event === "SIGNED_OUT") {
        ++syncRequest.current;
        restoreGuest();
        setTab("map");
        setEntryStage("welcome");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { loadedUserId.current = null; setLoadError(""); return; }
    if (loadedUserId.current !== user.id) {
      loadedUserId.current = user.id;
      setSaveBusy(false); setListBusy(false); setAdding(false); setCandidate(null); setEditingVisitId(null);
      setCities([]); setSelected(null); setWishlist([]); setLists([]); setManualOrder(null);
      setCompareIds(["", ""]);
      setProfileName(user.user_metadata?.display_name || user.email?.split("@")[0] || "Traveller");
    }
    let active = true;
    const refresh = async () => {
      if (journalOperations.current.busy) return;
      const requestId = ++syncRequest.current;
      setSyncStatus("loading");
      setLoadError("");
      const [visitsResult, stateResult] = await Promise.allSettled([loadVisits(user.id), loadAppState(user.id)]);
      if (!active || journalOperations.current.busy || requestId !== syncRequest.current) return;
      if (visitsResult.status === "fulfilled") {
        const stored = visitsResult.value;
        setCities(stored);
        setSelected(current => current ? stored.find(city => city.id === current.id) || null : null);
        if (stored.length >= 2) setCompareIds([stored[0].id, stored[1].id]);
        else if (stored.length === 1) setCompareIds([stored[0].id, stored[0].id]);
        else setCompareIds(["", ""]);
      }
      if (stateResult.status === "fulfilled") {
        const appState = stateResult.value;
        setWishlist(appState.wishlist);
        setLists(appState.lists);
        setManualOrder(appState.rankingOrder.length ? appState.rankingOrder : null);
        setYearlyGoal(appState.yearlyGoal);
        setGoalDraft(String(appState.yearlyGoal));
        setProfileName(appState.displayName || user.user_metadata?.display_name || user.email?.split("@")[0] || "Traveller");
      }
      const failed = [visitsResult.status === "rejected" ? "visits" : null, stateResult.status === "rejected" ? "lists and preferences" : null].filter(Boolean);
      if (failed.length) setLoadError(`Could not load ${failed.join(" or ")}. Your saved data has not been deleted.`);
      setSyncStatus("idle");
    };
    refresh();
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; document.removeEventListener("visibilitychange", onVisible); };
  }, [user?.id, loadRetry]);

  useEffect(() => {
    const needle = normalizeSearch(query.trim());
    if (needle.length < 2) {
      setSearchResults(suggestions);
      setSearching(false);
      return;
    }

    const prefix = needle.replace(/[^a-z0-9]/g, "").slice(0, 2) || "__";
    const controller = new AbortController();
    setSearching(true);

    fetch(`/cities/${prefix}.json`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : [])
      .then((records: [string, string, string, string, number, number, number, string, string?][]) => {
        const matchingRecords = records
          .filter(record =>
            normalizeSearch(record[0]).includes(needle) ||
            normalizeSearch(record[1]).includes(needle) ||
            normalizeSearch(record[2]).includes(needle)
          );
        const uniqueRecords = [...new Map(
          matchingRecords.map(record => [
            record[8] || `${normalizeSearch(record[0])}|${record[2]}|${record[4]}|${record[5]}`,
            record
          ])
        ).values()];
        const matches = uniqueRecords
          .slice(0, 12)
          .map(record => ({
            geonameId: record[8] || null,
            name: record[0],
            ascii: record[1],
            country: record[2],
            continent: record[3],
            lat: record[4],
            lng: record[5],
            population: record[6],
            emoji: countryFlag(record[7])
          }));
        setSearchResults(matches);
      })
      .catch(error => {
        if (error.name !== "AbortError") setSearchResults([]);
      })
      .finally(() => setSearching(false));

    return () => controller.abort();
  }, [query]);

  function beginAdd(city: CityOption | City) {
    visitOperationId.current = crypto.randomUUID();
    setSaveError("");
    setEditingVisitId(null);
    setCandidate({ ...city, id: city.id === undefined ? undefined : String(city.id) });
    setQuery(city.name);
    setRatings({ personal: 4, culture: 4, architecture: 4, food: 4, nature: null, nightlife: null });
    setPersonalOnly(false);
    setDateFrom("");
    setDateTo("");
    setVisitType("");
    setNote("");
  }

  function openAddCity() {
    setSaveError("");
    setEditingVisitId(null);
    setCandidate(null);
    setQuery("");
    setSearchResults(suggestions);
    setSearching(false);
    setAdding(true);
  }

  function closeVisitEditor() {
    if (journalOperations.current.busy) return;
    setAdding(false);
    setEditingVisitId(null);
  }

  function editSelectedVisit() {
    if (!selected) return;
    setSaveError("");
    setEditingVisitId(String(selected.id));
    setEditorReturnTab(tab === "city" ? "city" : "map");
    setCandidate({
      geonameId: selected.geonameId,
      name: selected.name,
      country: selected.country,
      continent: selected.continent,
      lat: selected.lat,
      lng: selected.lng,
      emoji: selected.emoji
    });
    setQuery(selected.name);
    setRatings({ ...selected.ratings });
    setPersonalOnly([...requiredRatingKeys.slice(1),...optionalRatingKeys].every(key=>selected.ratings[key]===null));
    setDateFrom(selected.dateFrom);
    setDateTo(selected.dateTo);
    setVisitType(selected.visitType);
    setNote(selected.note);
    setAdding(true);
  }

  async function saveYearlyGoal() {
    const nextGoal = Math.min(999, Math.max(1, Math.round(Number(goalDraft))));
    if (!Number.isFinite(nextGoal)) return;
    await runJournalMutation(async () => { if (user) await saveStoredYearlyGoal(nextGoal, user.id); }, () => {
      setYearlyGoal(nextGoal); setGoalDraft(String(nextGoal)); setEditingGoal(false);
    });
  }
  async function saveCity() {
    if (saveBusy || !candidate || !requiredRatingsComplete || invalidDateRange) return;
    setSaveError("");
    const draftCity = { ...candidate, rating: draftOverall, ratings: draftRatings, dateFrom, dateTo, visitType, note };
      await runJournalMutation(async () => {
        const operationId = visitOperationId.current || (visitOperationId.current = crypto.randomUUID());
        return !user ? { ...draftCity, id: editingVisitId || operationId, createdAt: editingVisitId ? cities.find(city => String(city.id) === editingVisitId)?.createdAt : new Date().toISOString() }
          : editingVisitId ? await updateVisit({ ...draftCity, id: editingVisitId } as StoredCity, user.id)
          : await createVisit(draftCity as Omit<StoredCity, "id">, operationId, user.id);
      }, savedCity => {
        setCities(current => editingVisitId ? current.map(city => String(city.id) === editingVisitId ? savedCity : city) : [savedCity, ...current]);
        setSelected(savedCity); setAdding(false); setCandidate(null); setQuery("");
        setTab(editingVisitId ? editorReturnTab : "map"); setEditingVisitId(null);
      }, error => setSaveError(error instanceof Error ? error.message : "The visit could not be saved."));
  }
  async function submitAuth() {
    if (authBusy) return;
    if (!supabase) {
      setAuthMessage("Account services are temporarily unavailable. You can continue as a guest and try again later.");
      return;
    }
    setAuthBusy(true);
    setAuthMessage("");
    try {
      if (authView === "signup") {
        if (authEmail.trim().toLowerCase() === reviewAccountEmail) {
          const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
          if (error) throw error;
          setAuthMessage("");
          setAuthOpen(false);
          return;
        }
        const email = authEmail.trim().toLowerCase();
        signupPending.current = true;
        const { data, error } = await supabase.auth.signUp({
          email,
          password: authPassword,
          options: { data: { display_name: authName.trim() }, emailRedirectTo: authRedirectUrl() }
        });
        if (error) { signupPending.current = false; throw error; }
        if (data.session) {
          signupPending.current = false;
          await supabase.auth.signOut();
          throw new Error("Email confirmation is not enabled for this project. Please contact support before creating an account.");
        }
        savePendingSignupEmail(email);
        setAuthEmail(email);
        setVerificationCode("");
        setResendCooldown(60);
        setAuthView("verify");
        setAuthMessage("");
      } else if (authView === "signin") {
        signupPending.current = false;
        const email = authEmail.trim().toLowerCase();
        const { error } = await supabase.auth.signInWithPassword({ email, password: authPassword });
        if (error) {
          if (/email not confirmed/i.test(error.message)) {
            savePendingSignupEmail(email);
            signupPending.current = true;
            setAuthView("verify");
            setAuthMessage("Confirm your email with the code we sent, or request a new one.");
            return;
          }
          throw error;
        }
        clearPendingSignupEmail();
        setAuthPassword("");
        setAuthOpen(false);
        setEntryStage("done");
      } else if (authView === "verify") {
        if (!new RegExp(`^[0-9]{${emailOtpLength}}$`).test(verificationCode)) {
          throw new Error(`Enter the full ${emailOtpLength}-digit code from your email.`);
        }
        const { data, error } = await supabase.auth.verifyOtp({ email: authEmail.trim().toLowerCase(), token: verificationCode, type: "email" });
        if (error) throw error;
        clearPendingSignupEmail();
        setVerificationCode("");
        setAuthPassword("");
        if (!data.session) {
          signupPending.current = false;
          setAuthView("signin");
          setAuthMessage("Email confirmed. Sign in with your password to continue.");
          return;
        }
        setAuthOpen(false);
        let onboarded = false;
        try { onboarded = window.localStorage.getItem(ONBOARDING_KEY) === "complete"; } catch { /* Continue onboarding without local storage. */ }
        signupPending.current = !onboarded;
        setEntryStage(onboarded ? "done" : "cards");
      } else if (authView === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim().toLowerCase(), { redirectTo: authRedirectUrl() });
        if (error) throw error;
        setAuthMessage("Password reset instructions have been sent if that account exists.");
      } else if (authView === "reset") {
        const { error } = await supabase.auth.updateUser({ password: authPassword });
        if (error) throw error;
        setAuthMessage("Password updated. You can continue using CityLog.");
      }
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function resendVerificationCode() {
    if (!supabase || authBusy || resendCooldown > 0) return;
    setAuthBusy(true);
    setAuthMessage("");
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: authEmail.trim().toLowerCase(), options: { emailRedirectTo: authRedirectUrl() } });
      if (error) throw error;
      setResendCooldown(60);
      setAuthMessage("A new code is on its way. Check your inbox and spam folder.");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Could not resend the code. Try again shortly.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function exportMyData() {
    if (!user) return;
    await runJournalMutation(async () => downloadAccountData(), payload => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `citylog-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
  }
  async function removeAccount() {
    if (!supabase || !user) return;
    if (!window.confirm("Permanently delete your account, visits, ratings and notes? This cannot be undone.")) return;
    const client = supabase;
    await runJournalMutation(async isCurrent => {
      const { data: { session } } = await client.auth.getSession();
      if (!isCurrent() || !session || session.user.id !== user.id) throw new Error("Account changed.");
      const { data, error } = await client.functions.invoke("delete-account", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      if (error || !data?.deleted) throw error || new Error("Account deletion did not complete.");
      if (isCurrent()) await client.auth.signOut();
    }, () => {}, () => setAuthMessage("Could not delete your account. Please retry or contact support."));
  }
  async function removeSelectedVisit() {
    if (!selected || !window.confirm(`Delete this visit to ${selected.name}? Other visits will be kept.`)) return;
    const replacement = storyHistory.find(city => city.id !== selected.id);
    const nextOrder = manualOrder ? fullRanking.flatMap(id => id !== selected.id ? [id] : replacement ? [replacement.id] : []) : null;
    await runJournalMutation(async isCurrent => {
      if (!user) return null;
      // Transfer the representative before deletion; a failed deletion cannot lose its slot.
      if (nextOrder) await saveRankingOrder(nextOrder.map(String), user.id);
      if (!isCurrent()) throw new Error("Account changed.");
      return deleteVisit(String(selected.id), user.id);
    }, deletion => {
      setCities(current => current.filter(city => city.id !== selected.id));
      const remaining = storyHistory.filter(city => city.id !== selected.id);
      setSelected(remaining[0] || null);
      setLists(current => current.map(list => ({ ...list, cityIds: list.cityIds.filter(id => id !== selected.id) })));
      setManualOrder(nextOrder);
      if (tab === "city" && !remaining.length) setTab("log");
      if (deletion?.cleanupPending) setCleanupWarning("Visit deleted, but an older photograph could not be cleaned up. Please contact support.");
    });
  }
  async function addWantToVisit(city: CityOption) {
    const existing = wishlist.find(item => cityIdentity(item) === cityIdentity(city));
    await runJournalMutation(async () => {
      if (existing) { if (user) await removeWishlistCity({ id: existing.id || "", name: existing.name, country: existing.country }, user.id); return null; }
      return user ? await addWishlistCity(city, user.id) : { ...city, id: crypto.randomUUID() };
    }, saved => setWishlist(current => saved ? [...current, saved] : current.filter(item => cityIdentity(item) !== cityIdentity(city))));
  }
  async function reorderRanking(targetId: CityId) {
    if (draggedCity === null || draggedCity === targetId) return;
    const source = cities.find(city => city.id === draggedCity), target = cities.find(city => city.id === targetId);
    if (!source || !target) return;
    const order = reorderVisible(fullRanking, displayedRanked.map(rankingId), rankingId(source), rankingId(target));
    setDraggedCity(null);
    await runJournalMutation(async () => { if (user) await saveRankingOrder(order.map(String), user.id); }, () => setManualOrder(order));
  }
  async function moveRankedCity(cityId: CityId, direction: -1 | 1) {
    const visible = displayedRanked.map(rankingId);
    const city = cities.find(item => item.id === cityId);
    if (!city) return;
    const index = visible.indexOf(rankingId(city)), next = index + direction;
    if (index < 0 || next < 0 || next >= visible.length) return;
    const order = reorderVisible(fullRanking, visible, visible[index], visible[next]);
    await runJournalMutation(async () => { if (user) await saveRankingOrder(order.map(String), user.id); }, () => setManualOrder(order));
  }
  async function moveWishlistCity(city: CityOption, direction: -1 | 1) {
    const index = wishlist.findIndex(item => cityIdentity(item) === cityIdentity(city)), next = index + direction;
    if (index < 0 || next < 0 || next >= wishlist.length) return;
    const ordered = [...wishlist];
    [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
    await runJournalMutation(async () => { if (user) await saveWishlistOrder(ordered.map(city => String(city.id)), user.id); }, () => setWishlist(ordered));
  }
  function selectComparedCity(index: 0 | 1, cityId: string) {
    const next: [CityId, CityId] = [compared[0]?.id || "", compared[1]?.id || ""];
    if (String(next[1 - index]) === cityId) next[1 - index] = next[index];
    next[index] = cityId;
    setCompareIds(next);
  }

  async function createList() {
    const title = newListTitle.trim();
    if (!title) return;
    await runJournalMutation(async () => user ? await createPersonalList(title, lists.length, undefined, user.id) : { id: crypto.randomUUID(), title, cityIds: [] }, saved => {
      setLists(current => [...current, saved]); setNewListTitle("");
    });
  }
  function startEditingList(list: PersonalList) {
    setEditingListId(list.id);
    setListTitleDraft(list.title);
    setListEditError("");
  }

  async function saveListTitle(listId: CityId) {
    const title = listTitleDraft.trim();
    if (!title || title.length > 100) { setListEditError("Choose a title between 1 and 100 characters."); return; }
    await runJournalMutation(async () => { if (user) await renamePersonalList(String(listId), title, user.id); }, () => {
      setLists(current => current.map(list => list.id === listId ? { ...list, title } : list)); setEditingListId(null); setListEditError("");
    }, error => setListEditError(error instanceof Error ? error.message : "Could not rename this list."));
  }
  async function removeList(list: PersonalList) {
    if (!window.confirm(`Delete “${list.title}”? The cities and visits in it will be kept.`)) return;
    await runJournalMutation(async () => { if (user) await deletePersonalList(String(list.id), user.id); }, () => {
      setLists(current => current.filter(item => item.id !== list.id)); setEditingListId(null); setListEditError("");
    }, () => setListEditError("Could not delete this list."));
  }
  async function removeCityFromList(list: PersonalList, cityId: CityId) {
    const cityIds = list.cityIds.filter(id => id !== cityId);
    await runJournalMutation(async () => { if (user) await savePersonalListCities(String(list.id), cityIds.map(String), user.id); }, () => {
      setLists(current => current.map(item => item.id === list.id ? { ...item, cityIds } : item)); setListEditError("");
    }, () => setListEditError("Could not remove this city from the list."));
  }
  async function moveListCity(listId: CityId, cityId: CityId, direction: -1 | 1) {
    const list = lists.find(item => item.id === listId);
    if (!list) return;
    const cityIds = [...list.cityIds], index = cityIds.indexOf(cityId), next = index + direction;
    if (index < 0 || next < 0 || next >= cityIds.length) return;
    [cityIds[index], cityIds[next]] = [cityIds[next], cityIds[index]];
    await runJournalMutation(async () => { if (user) await savePersonalListCities(String(listId), cityIds.map(String), user.id); }, () => {
      setLists(current => current.map(item => item.id === listId ? { ...item, cityIds } : item));
    });
  }
  async function addCityToList(listId: CityId, cityId: CityId) {
    const list = lists.find(item => item.id === listId);
    if (!list || list.cityIds.includes(cityId)) return;
    const cityIds = [...list.cityIds, cityId];
    await runJournalMutation(async () => { if (user) await savePersonalListCities(String(listId), cityIds.map(String), user.id); }, () => {
      setLists(current => current.map(item => item.id === listId ? { ...item, cityIds } : item));
    });
  }
  async function toggleManualOrder() {
    const next = manualOrder ? null : fullRanking;
    await runJournalMutation(async () => { if (user) await saveRankingOrder(next ? next.map(String) : [], user.id); }, () => setManualOrder(next));
  }
  return (
    <main className={`app-shell view-${tab} ${entryStage !== "done" ? "entry-active" : ""} ${adding ? "editor-open" : ""}`}>
      <div className="product-layer" inert={entryStage !== "done" || authOpen || adding} aria-hidden={entryStage !== "done" || undefined}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><MapPin size={18}/></span><span>citylog</span></div>
        <nav className="desktop-nav" aria-label="Primary">
          <button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}><MapIcon/>Map</button>
          <button className={tab === "rankings" ? "active" : ""} onClick={() => setTab("rankings")}><Trophy/>Rankings</button>
          <button className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}><BookOpen/>Log</button>
          <button className={tab === "compare" ? "active" : ""} onClick={() => setTab("compare")}><GitCompareArrows/>Compare</button>
          <button className={tab === "lists" ? "active" : ""} onClick={() => setTab("lists")}><ListPlus/>My Lists</button>
          <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><UserRound/>Profile</button>
        </nav>
        <div className="sidebar-card">
          <span className="eyebrow">YOUR JOURNEY</span>
          <strong>{citySummaries.length} cities</strong>
          <p>across {new Set(cities.map(c => c.country)).size} countries</p>
          <div className="progress"><span style={{ width: `${goalProgress}%` }}/></div>
          <small>{goalProgress}% of your {currentYear} goal</small>
        </div>
        <button className="avatar-row account-entry" onClick={() => user ? setTab("profile") : setAuthOpen(true)}>
          <span className="avatar">{user ? (user.user_metadata?.display_name || user.email || "U").slice(0, 2).toUpperCase() : "?"}</span>
          <span><strong>{user ? user.user_metadata?.display_name || "My account" : "Create an account"}</strong><small>{user ? "Your private journal" : "Keep your travels safe"}</small></span>
        </button>
      </aside>

      <section className="main-pane">
        {!user && guestStorageError && <div className="guest-import" role="alert">{guestStorageError}</div>}
        <header className="topbar">
          <div>
            {nativeMode && tab === "map" && <div className="native-only native-map-brand"><span className="brand-mark"><MapPin size={18}/></span><span>citylog</span></div>}
            <p className="kicker">{tab === "map" ? "YOUR TRAVEL MAP" : tab === "rankings" ? "YOUR FAVOURITES" : tab === "log" ? "YOUR TRAVEL LOG" : tab === "compare" ? "CITY HEAD TO HEAD" : tab === "lists" ? "YOUR COLLECTIONS" : "YOUR JOURNEY"}</p>
            <h1>{tab === "map" ? "The world, according to you." : tab === "rankings" ? "Cities worth returning to." : tab === "log" ? "Every trip, in order." : tab === "compare" ? "How do your cities compare?" : tab === "lists" ? "Save places your way." : "A life well travelled."}</h1>
          </div>
          <div className="top-actions">
            {!user && <button className="account-btn" onClick={() => { setAuthView("welcome"); setAuthOpen(true); }}>Sign in</button>}
            <button className="primary-btn" onClick={openAddCity}><Plus/>Log a city</button>
          </div>
        </header>

        {tab === "map" && (
          <>
            <div className="control-row">
              {nativeMode ? <div className="compact-categories" ref={categoryMenuRef}>
                <button className={category === "Overall" ? "active" : ""} onClick={() => { setCategory("Overall"); setCategoryMenuOpen(false); }}>Overall</button>
                <div className="category-select">
                  <button type="button" className={category !== "Overall" ? "selected" : ""} aria-label="Map rating category" aria-expanded={categoryMenuOpen} aria-haspopup="menu" onClick={() => setCategoryMenuOpen(value => !value)}>{category === "Overall" ? "Categories" : category}<ChevronDown className={categoryMenuOpen ? "up" : ""}/></button>
                  {categoryMenuOpen && <div className="category-menu" role="menu" aria-label="Map rating category">{categories.slice(1).map(item => <button type="button" role="menuitemradio" aria-checked={category === item} key={item} onClick={() => { setCategory(item); setCategoryMenuOpen(false); }}><span>{item}</span>{category === item && <Check/>}</button>)}</div>}
                </div>
              </div> : <div className="segmented">{categories.map(item=><button key={item} className={category===item?"active":""} onClick={()=>setCategory(item)}>{item}</button>)}</div>}
            </div>

            <div className="map-card">
              <InteractiveMap cities={mapCities} wishlist={wishlist} selected={selected} onSelect={setSelected} scoreCategory={category}/>
              <div className="map-legend"><span>0</span>{["#CD554F","#E28A43","#D4B849","#62A461","#236844"].map(c => <i key={c} style={{ background: c }}/>) }<span>4.5+</span><i className="purple-key"/><span>Want to visit</span></div>
              {selected && mapCities.some(c => c.id === selected.id) && (
                <article className="city-preview">
                  <button className="close-btn" onClick={() => setSelected(null)} aria-label="Close"><X/></button>
                  <div className="preview-copy">
                    <p className="city-meta">{selected.country}</p>
                    <div className="preview-title"><h2>{selected.name}</h2><strong style={{color:colorForScore(selected.rating)}}>{selected.rating.toFixed(1)} ★</strong></div>
                    {selected.note && <p className="preview-note">{selected.note}</p>}
                    <div className="preview-actions">
                      <button className="text-btn" onClick={()=>{setCityReturnTab("map");setTab("city");}}>View City Story <span>→</span></button>
                    </div>
                  </div>
                </article>
              )}
              {!citySummaries.length && syncStatus !== "loading" && !loadError && <div className="map-empty"><p className="kicker">YOUR STORY STARTS SOMEWHERE</p><h2>What city comes to mind?</h2><p>One place. One memory. The beginning of your map.</p><button className="primary-btn" onClick={openAddCity}><Plus/>Log your first city</button></div>}
            </div>
          </>
        )}

        {tab === "rankings" && (
          <div className={`rankings-layout ${rankEditMode ? "is-editing" : ""}`}>
            <div className="rankings-head">
              <div className="segmented">{categories.map(item => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
              {nativeMode && <button className="collection-edit-toggle" aria-label={rankEditMode ? "Done reordering rankings" : "Reorder rankings"} aria-pressed={rankEditMode} onClick={() => setRankEditMode(value => !value)}>{rankEditMode ? <span>Done</span> : <MoreHorizontal/>}</button>}
              <button className="filter-btn" onClick={() => nativeMode ? setFilterOpen(!filterOpen) : toggleManualOrder()}>
                {nativeMode ? <><SlidersHorizontal/>Filters{continent !== "All" && <span className="filter-dot"/>}</> : <><ListFilter/>{manualOrder ? "Custom order · Reset" : "Drag to reorder"}<ChevronDown/></>}
              </button>
              {nativeMode && filterOpen && <div className="filter-popover">
                <label>Continent</label>
                <select value={continent} onChange={event => setContinent(event.target.value)}>
                  {["All", "Europe", "Asia", "Africa", "North America", "South America", "Oceania"].map(item => <option key={item}>{item}</option>)}
                </select>
              </div>}
            </div>
            <div className="ranking-list">
              {displayedRanked.map((city, index) => (
                <div className={`rank-row ${draggedCity === city.id ? "dragging" : ""}`} key={city.id} draggable={!nativeMode} onDragStart={() => setDraggedCity(city.id)} onDragOver={event => event.preventDefault()} onDrop={() => reorderRanking(city.id)}>
                  {!nativeMode && <GripVertical className="drag-handle" aria-label="Drag to reorder"/>}
                  <span className={`rank-number ${index < 3 ? `podium podium-${index + 1}` : ""}`} aria-label={index === 0 ? "Gold ranking" : index === 1 ? "Silver ranking" : index === 2 ? "Bronze ranking" : undefined}>{index + 1}</span>
                  <FlagMark emoji={city.emoji} country={city.country} className="rank-flag"/>
                  <button className="rank-main rank-city-link" onClick={() => { setSelected(city); setCityReturnTab("rankings"); setTab("city"); }}><strong>{city.name}</strong><small>{city.country}</small></button>
                  <span className="rank-rating"><strong>{(scoreFor(city, category) || 0).toFixed(1)}</strong><Star fill={colorForScore(scoreFor(city, category) || 0)} color={colorForScore(scoreFor(city, category) || 0)}/></span>
                  <span className="rank-bar"><i style={{ width: `${(scoreFor(city, category) || 0) * 20}%`, background: colorForScore(scoreFor(city, category) || 0) }}/></span>
                  {nativeMode && rankEditMode && <span className="rank-order-buttons native-only"><button disabled={index === 0} onClick={() => moveRankedCity(city.id, -1)} aria-label={`Move ${city.name} up`}><ArrowUp/></button><button disabled={index === displayedRanked.length - 1} onClick={() => moveRankedCity(city.id, 1)} aria-label={`Move ${city.name} down`}><ArrowDown/></button></span>}
                </div>
              ))}
            </div>
            {!displayedRanked.length && <div className="journal-empty"><h2>{citySummaries.length ? "No cities in this view yet." : "Your rankings start with a city."}</h2><p>{citySummaries.length ? "Try another category or filter to see your cities." : "Log a city to see how it compares with the places you know."}</p><button className="primary-btn" onClick={citySummaries.length ? () => {setCategory("Overall");setContinent("All");} : openAddCity}>{citySummaries.length ? "Clear filters" : "Log a city"}</button></div>}
          </div>
        )}

        {tab === "log" && (
          <div className="log-layout">
            <div className="log-summary"><BookOpen/><span><strong>{cities.length} entries</strong><small>Dated visits first</small></span></div>
            <div className="log-list">
              {datedVisits.map((city, index) => (
                <button key={city.id} className="log-entry" onClick={() => { setSelected(city); setCityReturnTab("log"); setTab("city"); }}>
                  <span className="log-date" title={formatVisitDate(city.dateFrom, city.dateTo)}>{visitMonth(city.dateFrom || city.dateTo)}</span>
                  <span className="log-line"><i className={index === 0 ? "latest" : ""}/></span>
                  <FlagMark emoji={city.emoji} country={city.country} className="rank-flag"/>
                  <span className="rank-main"><strong>{city.name}</strong><small>{city.country}</small></span>
                  <span className="rank-rating"><strong>{city.rating.toFixed(1)}</strong><Star fill={colorForScore(city.rating)} color={colorForScore(city.rating)}/></span>
                </button>
              ))}
              {undatedVisits.length > 0 && <div className="log-undated-heading"><span>Date not added</span><small>{undatedVisits.length} {undatedVisits.length === 1 ? "entry" : "entries"}</small></div>}
              {undatedVisits.map(city => (
                <button key={city.id} className="log-entry undated" onClick={() => { setSelected(city); setCityReturnTab("log"); setTab("city"); }}>
                  <span className="log-date" aria-hidden="true"/>
                  <span className="log-line"><i/></span>
                  <FlagMark emoji={city.emoji} country={city.country} className="rank-flag"/>
                  <span className="rank-main"><strong>{city.name}</strong><small>{city.country}</small></span>
                  <span className="rank-rating"><strong>{city.rating.toFixed(1)}</strong><Star fill={colorForScore(city.rating)} color={colorForScore(city.rating)}/></span>
                </button>
              ))}
            </div>
            {!cities.length && <div className="journal-empty"><h2>Your log is ready.</h2><p>Each visit you record will appear here, with your rating and memories.</p><button className="primary-btn" onClick={openAddCity}>Log your first city</button></div>}
          </div>
        )}

        {tab === "city" && selected && currentCity && (
          <div className="city-detail-layout">
            <div className="story-navigation"><button className="city-detail-back" onClick={() => {setSelected(currentCity);setTab(cityReturnTab);}}><ArrowLeft/>{cityReturnTab === "log" ? "Your log" : cityReturnTab === "rankings" ? "Rankings" : "Your map"}</button><span>{storyHistory.length} {storyHistory.length===1?"visit":"visits"} · A story still being written</span></div>
            <article className="city-detail-card">
              <header>
                <div><p className="kicker">CITY STORY · {selected.country.toUpperCase()}</p><h2>{selected.name}</h2><small>{selected.continent} · {displayedRanked.findIndex(city=>cityIdentity(city)===cityIdentity(selected))>=0 ? `#${displayedRanked.findIndex(city=>cityIdentity(city)===cityIdentity(selected))+1} in your current ranking` : "Your personal perspective"}</small></div>
                <div className="story-overall"><strong style={{ color: colorForScore(currentCity.rating) }}>{currentCity.rating.toFixed(1)}<span> / 5</span></strong><small>Latest visit · overall</small></div>
              </header>
              {selected.photoUrl && <img className="story-photo" src={selected.photoUrl} alt={`${selected.name}, from your visit`} />}
              <div className="story-columns"><section className="story-current"><div className="story-section-title"><p className="kicker">{selected.id===currentCity.id?"CURRENT CITY LOG":"PAST VISIT"}</p>{selected.id!==currentCity.id&&<button className="text-btn" onClick={()=>setSelected(currentCity)}>Latest visit →</button>}</div><h3>{formatVisitDate(selected.dateFrom, selected.dateTo)}</h3><p className="story-visit-type">{selected.visitType || "Personal visit"} · {selected.rating.toFixed(1)} ★</p>
              <div className="city-detail-ratings">
                {[...requiredRatingKeys, ...optionalRatingKeys].map(key => selected.ratings[key] !== null && (
                  <div key={key}><span>{key === "personal" ? "Personal experience" : key}</span><b>{selected.ratings[key]?.toFixed(1)}</b><i><span style={{ width: `${(selected.ratings[key] || 0) * 20}%`, background: colorForScore(selected.ratings[key] || 0) }}/></i></div>
                ))}
              </div>
              <section className="story-memory"><p className="kicker">YOUR MEMORY</p><p>{selected.note || "There’s more to this story. Add a memory when you’re ready."}</p></section>
              <div className="city-detail-actions">
                <button className="visit-action edit" onClick={editSelectedVisit}><Pencil/>Edit visit</button>
                <button className="visit-action delete" onClick={removeSelectedVisit}><X/>Delete</button>
              </div></section><section className="story-history"><div className="story-section-title"><p className="kicker">LOG HISTORY</p><span>{storyHistory.length} entries</span></div><div className="history-timeline">{storyHistory.map(visit=><button key={visit.id} className={`history-entry ${visit.id===selected.id?"active":""}`} onClick={()=>setSelected(visit)}><i style={{background:colorForScore(visit.rating)}}/><span><strong>{visitMonth(visit.dateFrom || visit.dateTo, true)}</strong><small>{visit.visitType || "Visit"}</small>{visit.note&&<p>{visit.note}</p>}</span><b>{visit.rating.toFixed(1)} ★</b></button>)}</div><button className="primary-btn" onClick={()=>{beginAdd(currentCity);setEditorReturnTab("city");setAdding(true);}}><Plus/>Log another visit</button><p className="history-hint">A new visit adds to your story. Earlier memories stay here.</p></section></div>
            </article>
          </div>
        )}

        {tab === "compare" && (
          <div className="compare-layout">
            <section className="compare-section standalone-section">
              <div className="section-heading"><span><GitCompareArrows/></span><div><p className="kicker">COMPARE CITIES</p><h2>Head to head</h2></div></div>
              {citySummaries.length < 2 ? <div className="compare-empty"><p>Log at least two cities to compare their ratings side by side.</p><button className="primary-btn" onClick={openAddCity}>Log a city</button></div> : <><div className="compare-pickers">
                {[0, 1].map(index => (
                  <select key={index} aria-label={`Compare city ${index + 1}`} value={String(compared[index]?.id || "")} onChange={event => selectComparedCity(index as 0 | 1, event.target.value)}>
                    {citySummaries.map(city => <option key={city.id} value={city.id}>{city.name}, {city.country}</option>)}
                  </select>
                ))}
              </div>
              <div className="compare-grid">
                {compared.map((city, index) => (
                  <article key={`${city.id}-${index}`}>
                    <FlagMark emoji={city.emoji} country={city.country} className="compare-flag"/><h3>{city.name}</h3><small>{city.country}</small>
                    <strong style={{ color: colorForScore(city.rating) }}>{city.rating.toFixed(1)}</strong>
                    <div className="compare-ratings">{[...requiredRatingKeys,...optionalRatingKeys].map(key => <p key={key}><span>{key === "personal" ? "Experience" : key}</span><b>{city.ratings[key]?.toFixed(1) || "—"}</b></p>)}</div>
                  </article>
                ))}
              </div></>}
            </section>
          </div>
        )}

        {tab === "lists" && (
          <div className="lists-layout">
            <section className="lists-section standalone-section">
              <div className="section-heading lists-intro"><span><ListPlus/></span><div><p className="kicker">MY LISTS</p><h2>Your collections</h2></div></div>
              <article className="personal-list want-list">
                <div><span className="list-icon"><Heart fill="currentColor"/></span><span className="collection-title"><h3>Want to Visit</h3><small>{wishlist.length} saved cities</small></span><span className="collection-header-actions"><button className="native-only want-add-city" onClick={openAddCity}><Plus/>Add city</button><button className="collection-edit-toggle" aria-label={wishlistEditMode ? "Done editing Want to Visit" : "Edit Want to Visit"} aria-pressed={wishlistEditMode} onClick={() => setWishlistEditMode(value => !value)}>{wishlistEditMode ? <span>Done</span> : <MoreHorizontal/>}</button></span></div>
                <div className="list-cities">{(showAllWishlist || wishlistEditMode ? wishlist : wishlist.slice(0, 6)).map((city, index) => <span key={city.id || cityIdentity(city)}><b>{index + 1}</b><span className="list-city-name"><FlagMark emoji={city.emoji} country={city.country} className="list-flag"/>{city.name}</span>{wishlistEditMode && <><span className="list-order"><button disabled={index === 0} aria-label={`Move ${city.name} higher on Want to Visit`} onClick={() => moveWishlistCity(city, -1)}><ArrowUp/></button><button disabled={index === wishlist.length - 1} aria-label={`Move ${city.name} lower on Want to Visit`} onClick={() => moveWishlistCity(city, 1)}><ArrowDown/></button></span><button aria-label={`Remove ${city.name}`} onClick={() => addWantToVisit(city)}><X/></button></>}</span>)}</div>
                {wishlist.length > 6 && !wishlistEditMode && <button className="wishlist-more" onClick={() => setShowAllWishlist(value => !value)}>{showAllWishlist ? "Show fewer" : `View all ${wishlist.length} cities`}<ChevronDown className={showAllWishlist ? "up" : ""}/></button>}
              </article>
              {lists.map(list => (
                <article className="personal-list" key={list.id}>
                  <div><span className="list-icon"><ListFilter/></span><span className="collection-title"><h3>{list.title}</h3><small>{list.cityIds.length} cities</small></span><button className="list-edit-btn collection-edit-toggle" onClick={() => editingListId === list.id ? setEditingListId(null) : startEditingList(list)} aria-label={editingListId === list.id ? `Done editing ${list.title}` : `Edit ${list.title}`} aria-pressed={editingListId === list.id}>{editingListId === list.id ? "Done" : <MoreHorizontal/>}</button></div>
                  {editingListId === list.id && <form className="list-editor" onSubmit={event => {event.preventDefault();saveListTitle(list.id);}}>
                    <label htmlFor={`list-title-${list.id}`}>List name</label>
                    <input id={`list-title-${list.id}`} value={listTitleDraft} maxLength={100} onChange={event => setListTitleDraft(event.target.value)}/>
                    {listEditError && <p role="alert">{listEditError}</p>}
                    <div><button type="submit" disabled={listBusy}>Save name</button><button type="button" disabled={listBusy} onClick={() => {setEditingListId(null);setListEditError("");}}>Cancel</button><button type="button" className="danger" disabled={listBusy} onClick={() => removeList(list)}>Delete list</button></div>
                  </form>}
                  <div className="list-cities">
                    {list.cityIds.map((id, index) => {
                      const city = cities.find(item => item.id === id);
                      return city ? <span key={id}><b>{index + 1}</b><span className="list-city-name"><FlagMark emoji={city.emoji} country={city.country} className="list-flag"/>{city.name}</span>{editingListId === list.id && <><span className="list-order"><button disabled={index === 0} aria-label={`Move ${city.name} up`} onClick={() => moveListCity(list.id, id, -1)}><ArrowUp/></button><button disabled={index === list.cityIds.length - 1} aria-label={`Move ${city.name} down`} onClick={() => moveListCity(list.id, id, 1)}><ArrowDown/></button></span><button className="list-remove-city" disabled={listBusy} aria-label={`Remove ${city.name} from ${list.title}`} onClick={() => removeCityFromList(list, id)}><X/></button></>}</span> : null;
                    })}
                    {editingListId === list.id && <select aria-label={`Add city to ${list.title}`} value="" onChange={event => {
                      const city = cities.find(candidate => String(candidate.id) === event.target.value);
                      if (city) addCityToList(list.id, city.id);
                    }}><option value="">+ Add a city</option>{citySummaries.filter(city => !list.cityIds.some(id => cities.some(visit => visit.id===id && cityIdentity(visit)===cityIdentity(city)))).map(city => <option key={city.id} value={city.id}>{city.name}</option>)}</select>}
                  </div>
                </article>
              ))}
              {!lists.length && <button className="list-example" onClick={() => setNewListTitle("Favourite capitals")}>Try a list: Favourite capitals →</button>}
              <div className="new-list"><input aria-label="New list title" value={newListTitle} onChange={event => setNewListTitle(event.target.value)} onKeyDown={event => { if (event.key === "Enter") createList(); }} placeholder="Name a new list, e.g. Favourite capitals"/><button onClick={createList}><Plus/>Create list</button></div>
              <section className="native-only native-compare">
                <div className="section-heading"><span><GitCompareArrows/></span><div><p className="kicker">COMPARE CITIES</p><h2>Head to head</h2></div></div>
                {citySummaries.length < 2 ? <div className="compare-empty"><p>Log at least two cities to compare their ratings side by side.</p><button className="primary-btn" onClick={openAddCity}>Log a city</button></div> : <><div className="compare-pickers">
                  {[0, 1].map(index => (
                    <select key={index} aria-label={`Compare city ${index + 1}`} value={String(compared[index]?.id || "")} onChange={event => selectComparedCity(index as 0 | 1, event.target.value)}>
                      {citySummaries.map(city => <option key={city.id} value={city.id}>{city.name}, {city.country}</option>)}
                    </select>
                  ))}
                </div>
                <div className="compare-grid">
                  {compared.map((city, index) => (
                    <article key={`native-${city.id}-${index}`}>
                      <FlagMark emoji={city.emoji} country={city.country} className="compare-flag"/><h3>{city.name}</h3><small>{city.country}</small>
                      <strong style={{ color: colorForScore(city.rating) }}>{city.rating.toFixed(1)}</strong>
                      <div className="compare-ratings">{[...requiredRatingKeys,...optionalRatingKeys].map(key => <p key={key}><span>{key === "personal" ? "Experience" : key}</span><b>{city.ratings[key]?.toFixed(1) || "—"}</b></p>)}</div>
                    </article>
                  ))}
                </div></>}
              </section>
            </section>
          </div>
        )}

        {tab === "profile" && (
          <div className="profile-layout">
            <div className="profile-hero">
              <span className="profile-avatar">{profileName === "Your travel journal" ? <Compass aria-label="Travel journal"/> : profileName.slice(0, 2).toUpperCase()}</span>
              <div><p className="kicker">TRAVEL JOURNAL</p><h2>{profileName}</h2><p>Collecting places, not things.</p></div>
            </div>
            <div className="stats-grid">
              <article><MapPin/><strong>{citySummaries.length}</strong><span>Cities logged</span></article>
              <article><Compass/><strong>{new Set(cities.map(c => c.country)).size}</strong><span>Countries</span></article>
              <article><Star/><strong>{citySummaries.length ? (citySummaries.reduce((a,c) => a + c.rating, 0) / citySummaries.length).toFixed(1) : "—"}</strong><span>Average rating</span></article>
            </div>
            <article className="insight-card"><span className="insight-icon"><Sparkles/></span><div><p className="kicker">YOUR TRAVEL STORY</p><h3>{cities.length ? `${cities.length} visits in your journal.` : "Your next chapter starts with a city."}</h3><p>Your ratings and memories build a picture of what matters to you.</p></div></article>
            <div className="year-card">
              <div>
                <p className="kicker">{currentYear} TRAVEL GOAL</p>
                <h3>{citiesThisYear} of {yearlyGoal} cities this year</h3>
              </div>
              <div className="goal-actions">
                <span>{goalProgress}%</span>
                <button className="edit-goal-btn" onClick={() => setEditingGoal(true)}><Pencil/>Edit goal</button>
              </div>
              <div className="wide-progress"><i style={{width:`${goalProgress}%`}}/></div>
              {editingGoal && (
                <form className="goal-editor" onSubmit={event => { event.preventDefault(); saveYearlyGoal(); }}>
                  <label htmlFor="yearly-city-goal">How many cities do you want to visit in {currentYear}?</label>
                  <div>
                    <input id="yearly-city-goal" type="number" min="1" max="999" value={goalDraft} onChange={event => setGoalDraft(event.target.value)}/>
                    <button type="submit">Save goal</button>
                    <button type="button" onClick={() => { setGoalDraft(String(yearlyGoal)); setEditingGoal(false); }}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
            <section className="account-settings">
              <p className="kicker">ACCOUNT & PRIVACY</p>
              <button className="replay-onboarding" onClick={()=>{setOnboardingNotice("");setEntryStage("cards");}}>Replay the CityLog introduction <span>→</span></button>
              {user ? <>
                <h3>{user.email}</h3>
                <p>Your cities, ratings and notes are private and accessible only to this account.</p>
                {guestImportAvailable && !guestNoticeDismissed && <div className="guest-data-action"><button className="guest-notice-dismiss" type="button" onClick={dismissGuestNotice} aria-label="Dismiss guest journal notice"><X aria-hidden="true"/></button><p>Travel entries from guest mode are still on this device.</p><button disabled={saveBusy} onClick={importGuestJournal}>{saveBusy ? "Moving entries…" : "Move guest entries to this account"}</button>{guestImportError && <p role="alert">{guestImportError}</p>}</div>}
                <div className="settings-actions">
                  {guestImportAvailable && guestNoticeDismissed && <button disabled={saveBusy} onClick={importGuestJournal}>{saveBusy ? "Moving entries…" : "Import guest entries"}</button>}
                  <button onClick={exportMyData}>Download My Data</button>
                  <a href={publicPageUrl("/support")} target={nativeMode ? "_blank" : undefined} rel={nativeMode ? "noreferrer" : undefined}>Support</a>
                  <a href={publicPageUrl("/privacy")} target={nativeMode ? "_blank" : undefined} rel={nativeMode ? "noreferrer" : undefined}>Privacy Policy</a>
                  <a href={publicPageUrl("/terms")} target={nativeMode ? "_blank" : undefined} rel={nativeMode ? "noreferrer" : undefined}>Terms of Use</a>
                  <button onClick={() => supabase?.auth.signOut()}>Sign out</button>
                  <button className="danger" onClick={removeAccount}>Delete Account</button>
                </div>
                {guestImportAvailable && guestNoticeDismissed && guestImportError && <p role="alert" className="guest-import-error">{guestImportError}</p>}
              </> : <>
                <h3>Keep your travel history safe.</h3>
                <p>Your guest journal is saved on this device. Create an account for cloud backup and access on other devices. Clearing browser or app data removes guest entries.</p>
                <button className="primary-btn" onClick={() => setAuthOpen(true)}>Create account or sign in</button>
                <div className="settings-actions"><a href={publicPageUrl("/support")}>Support</a><a href={publicPageUrl("/privacy")}>Privacy Policy</a><a href={publicPageUrl("/terms")}>Terms of Use</a></div>
              </>}
            </section>
            <aside className="future-note"><Sparkles/><span><strong>Coming later</strong><small>Soon you’ll be able to add friends and compare your cities together.</small></span></aside>
          </div>
        )}
      </section>

      <nav className="mobile-nav" aria-label="Primary">
        <button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}><MapIcon/><span>Map</span></button>
        <button className={tab === "rankings" ? "active" : ""} onClick={() => setTab("rankings")}><Trophy/><span>Rankings</span></button>
        <button className="add-mobile" aria-label="Log a city" onClick={openAddCity}><Plus/></button>
        <button className={tab === "log" || tab === "city" ? "active" : ""} onClick={() => setTab("log")}><BookOpen/><span>Log</span></button>
        <button className={`compare-tab ${tab === "compare" ? "active" : ""}`} onClick={() => setTab("compare")}><GitCompareArrows/><span>Compare</span></button>
        <button className={tab === "lists" ? "active" : ""} onClick={() => setTab("lists")}><ListPlus/><span>Lists</span></button>
        <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><UserRound/><span>Profile</span></button>
      </nav>
      </div>

      <Onboarding stage={entryStage} onStage={setEntryStage} notice={onboardingNotice} onGuest={enterGuest} onComplete={finishOnboarding} onAuth={mode=>{setAuthView(mode);setAuthMessage("");setAuthOpen(true);}}/>

      {adding && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) closeVisitEditor(); }}>
          <section className="add-modal" role="dialog" aria-modal="true" aria-labelledby="add-title">
            <div className="modal-head">
              <button className="back-btn" onClick={() => editingVisitId ? closeVisitEditor() : candidate ? setCandidate(null) : closeVisitEditor()}><ArrowLeft/></button>
              <div><p className="kicker">{editingVisitId ? "EDIT MEMORY" : "NEW MEMORY"}</p><h2 id="add-title">{candidate ? editingVisitId ? `Update ${candidate.name}` : `How was ${candidate.name}?` : "Where have you been?"}</h2></div>
              <button className="close-btn static" onClick={closeVisitEditor}><X/></button>
            </div>
            {!candidate ? (
              <>
                <label className="search-box"><Search/><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search for a city"/></label>
                <p className="section-label">{query ? searching ? "SEARCHING 234,000+ CITIES…" : "SEARCH RESULTS" : "SUGGESTED FOR YOU"}</p>
                <div className="suggestions">
                  {searchResults.map(city => (
                    <div className="suggestion-row" key={cityIdentity(city)}>
                      <button className="city-result" onClick={() => beginAdd(city)}><FlagMark emoji={city.emoji} country={city.country}/><span><strong>{city.name}</strong><small>{city.country} · {city.continent}{city.population ? ` · ${city.population.toLocaleString()} people` : ""}</small></span><Plus/></button>
                      <button className={`want-btn ${wishlist.some(item => cityIdentity(item) === cityIdentity(city)) ? "saved" : ""}`} onClick={() => addWantToVisit(city)} aria-label={`${wishlist.some(item => cityIdentity(item) === cityIdentity(city)) ? "Remove" : "Add"} ${city.name} ${wishlist.some(item => cityIdentity(item) === cityIdentity(city)) ? "from" : "to"} Want to Visit`}><Heart fill={wishlist.some(item => cityIdentity(item) === cityIdentity(city)) ? "currentColor" : "none"}/></button>
                    </div>
                  ))}
                  {!searching && query.length >= 2 && searchResults.length === 0 && <div className="empty-search">No matching city found. Try another spelling.</div>}
                </div>
                <p className="data-credit">Worldwide city data by <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a></p>
              </>
            ) : (
              <div className="rating-form">
                <div className="candidate-chip"><FlagMark emoji={candidate.emoji} country={candidate.country}/><div><strong>{candidate.name}</strong><small>{candidate.country}</small></div><Check/></div>
                <div className="overall-score" style={{ "--score-color": colorForScore(draftOverall) } as React.CSSProperties}>
                  <span><small>CALCULATED OVERALL</small><strong>{draftOverall.toFixed(1)}</strong></span>
                  <div><Star fill={colorForScore(draftOverall)} color={colorForScore(draftOverall)}/></div>
                </div>
                <div className="category-ratings">
                  <button type="button" className="rating-mode-toggle" aria-pressed={personalOnly} onClick={()=>{if(personalOnly)setRatings(current=>({...current,culture:current.culture??4,architecture:current.architecture??4,food:current.food??4}));setPersonalOnly(current=>!current);}}>{personalOnly ? "Add category ratings" : "Personal experience only"}</button>
                  {(personalOnly ? ["personal"] as RatingKey[] : requiredRatingKeys).map(key => (
                    <CategoryRating key={key} label={key === "personal" ? "Personal experience" : key[0].toUpperCase() + key.slice(1)} value={ratings[key]} onChange={value => setRatings(current => ({ ...current, [key]: value }))}/>
                  ))}
                  {!personalOnly && <p className="section-label optional-label">OPTIONAL RATINGS</p>}
                  {!personalOnly && optionalRatingKeys.map(key => (
                    <CategoryRating key={key} optional label={key[0].toUpperCase() + key.slice(1)} value={ratings[key]} onChange={value => setRatings(current => ({ ...current, [key]: value }))}/>
                  ))}
                </div>
                <div className="form-row date-range">
                  <label><span><CalendarDays/>Arrived <small>OPTIONAL</small></span><input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)}/></label>
                  <label><span><CalendarDays/>Left <small>OPTIONAL</small></span><input type="date" min={dateFrom || undefined} value={dateTo} onChange={event => setDateTo(event.target.value)}/></label>
                </div>
                {(dateFrom || dateTo) && <button type="button" className="rating-mode-toggle" onClick={()=>{setDateFrom("");setDateTo("");}}>Clear dates</button>}
                {invalidDateRange && <p role="alert" className="auth-message">The departure date cannot be before the arrival date.</p>}
                <label className="select-field"><span><Filter/>Visit type <small>OPTIONAL</small></span><select value={visitType} onChange={event => setVisitType(event.target.value)}><option value="">Choose a visit type</option><option>Holiday</option><option>City break</option><option>Road trip</option><option>Work</option><option>Study</option><option>Lived there</option><option>Visiting friends or family</option><option>Day trip</option></select></label>
                <label className="note-field"><span>Your memory <small>OPTIONAL</small></span><textarea value={note} onChange={e => setNote(e.target.value)} maxLength={160} placeholder="What made this city memorable?"/><small>{note.length}/160</small></label>
                {saveError && <p className="auth-message" role="alert">{saveError}</p>}
                {!user && <p className="guest-save-note">Saved on this device. You can move your journal to an account later.</p>}
                <button className="save-btn" disabled={saveBusy || !requiredRatingsComplete || invalidDateRange} onClick={saveCity}>{saveBusy ? "Saving your visit…" : editingVisitId ? <><Check/>Save changes · {draftOverall.toFixed(1)}</> : <><MapPin/>Add to my map · {draftOverall.toFixed(1)}</>}</button>
              </div>
            )}
          </section>
        </div>
      )}

      {authOpen && (
        <div className={`modal-backdrop auth-backdrop ${authView === "verify" ? "verify-backdrop" : ""}`} onMouseDown={event => { if (authView !== "verify" && event.target === event.currentTarget) setAuthOpen(false); }}>
          <section className={`auth-modal ${authView === "verify" ? "auth-verify" : ""}`} role="dialog" aria-modal="true" aria-labelledby="auth-title">
            {authView !== "verify" && <button className="close-btn static auth-close" onClick={() => setAuthOpen(false)} aria-label="Close account dialog"><X/></button>}
            {authView === "verify" ? <>
              <span className="auth-mark"><Check/></span>
              <p className="kicker">ONE LAST STEP</p>
              <h2 id="auth-title">Confirm your email.</h2>
              <p className="auth-verify-description">Enter the eight-digit code sent to <strong>{authEmail}</strong>. Your account will be ready once it’s confirmed.</p>
              <form onSubmit={event => { event.preventDefault(); void submitAuth(); }}>
                <label className="auth-field"><span>Verification code</span><input aria-label="Verification code" type="text" inputMode="numeric" pattern={`[0-9]{${emailOtpLength}}`} autoComplete="one-time-code" autoCapitalize="off" spellCheck={false} value={verificationCode} onChange={event => setVerificationCode(cleanEmailOtpInput(event.target.value))} required/></label>
                {verificationCode.length > 0 && verificationCode.length < emailOtpLength && <p className="auth-code-hint" role="status">{verificationCode.length} of {emailOtpLength} digits entered. Check for a missing digit.</p>}
                {authMessage && <p className="auth-message" role="status">{authMessage}</p>}
                <button type="submit" className="save-btn" disabled={authBusy || verificationCode.length !== emailOtpLength}>{authBusy ? "Checking code…" : "Confirm and continue"}</button>
              </form>
              <button className="forgot-link" disabled={authBusy || resendCooldown > 0} onClick={resendVerificationCode}>{resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}</button>
              <div className="verify-links"><button onClick={() => { clearPendingSignupEmail(); signupPending.current = false; setAuthView("signup"); setAuthMessage(""); setVerificationCode(""); }}>Change email</button><button onClick={() => { clearPendingSignupEmail(); signupPending.current = false; setAuthView("signin"); setAuthMessage(""); setVerificationCode(""); }}>Already have an account? Sign in</button></div>
            </> : authView === "welcome" ? <>
              <span className="auth-mark"><MapPin/></span>
              <p className="kicker">WELCOME TO CITYLOG</p>
              <h2 id="auth-title">Your travels, saved for good.</h2>
              <p>Explore the app first. When you’re ready, create a private account to save visits and sync them across devices.</p>
              {authMessage && <p className="auth-message">{authMessage}</p>}
              {!isSupabaseConfigured && <p className="config-note">Cloud accounts are ready in the code but this preview still needs its Supabase project keys.</p>}
              <button className="save-btn" onClick={() => { setAuthView("signup"); setAuthMessage(""); }}>Create free account</button>
              <button className="account-btn wide" onClick={() => { setAuthView("signin"); setAuthMessage(""); }}>I already have an account</button>
              <p className="legal-copy">By creating an account, you agree to the <a href={publicPageUrl("/terms")} target={nativeMode ? "_blank" : undefined} rel={nativeMode ? "noreferrer" : undefined}>Terms</a> and acknowledge the <a href={publicPageUrl("/privacy")} target={nativeMode ? "_blank" : undefined} rel={nativeMode ? "noreferrer" : undefined}>Privacy Policy</a>.</p>
            </> : <>
              <button className="auth-back" onClick={() => { setAuthView("welcome"); setAuthMessage(""); }}><ArrowLeft/>Back</button>
              <p className="kicker">{authView === "signup" ? "CREATE ACCOUNT" : authView === "signin" ? "WELCOME BACK" : authView === "forgot" ? "RESET PASSWORD" : "CHOOSE A NEW PASSWORD"}</p>
              <h2 id="auth-title">{authView === "signup" ? "Start your private travel log." : authView === "signin" ? "Sign in to CityLog." : authView === "forgot" ? "Check your inbox next." : "Secure your account."}</h2>
              <form onSubmit={event => { event.preventDefault(); void submitAuth(); }}>
                {authView === "signup" && <label className="auth-field"><span>Display name <small>OPTIONAL</small></span><input maxLength={80} value={authName} onChange={event => setAuthName(event.target.value)} autoComplete="name"/></label>}
                {authView !== "reset" && <label className="auth-field"><span>Email</span><input type="email" value={authEmail} onChange={event => setAuthEmail(event.target.value)} autoComplete="email" required/></label>}
                {authView !== "forgot" && <label className="auth-field"><span>Password</span><input type="password" minLength={8} value={authPassword} onChange={event => setAuthPassword(event.target.value)} autoComplete={authView === "signin" ? "current-password" : "new-password"} required/></label>}
                {authMessage && <p className="auth-message" role="status">{authMessage}</p>}
                {authView === "signup" && authEmail.trim().toLowerCase() === reviewAccountEmail && <p className="config-note">This is the pre-confirmed App Review account. Continue to sign in directly—no email verification is required.</p>}
                <button type="submit" className="save-btn" disabled={authBusy || (authView !== "reset" && !authEmail) || (authView !== "forgot" && authPassword.length < 8)}>{authBusy ? "Please wait…" : authView === "signup" && authEmail.trim().toLowerCase() === reviewAccountEmail ? "Open review account" : authView === "signup" ? "Create account" : authView === "signin" ? "Sign in" : authView === "forgot" ? "Send reset email" : "Update password"}</button>
              </form>
              {authView === "signin" && <button className="forgot-link" onClick={() => { setAuthView("forgot"); setAuthMessage(""); }}>Forgotten your password?</button>}
              {authView === "signup" && <p className="legal-copy">Your account is private. Read our <a href={publicPageUrl("/privacy")} target={nativeMode ? "_blank" : undefined} rel={nativeMode ? "noreferrer" : undefined}>Privacy Policy</a>, <a href={publicPageUrl("/terms")} target={nativeMode ? "_blank" : undefined} rel={nativeMode ? "noreferrer" : undefined}>Terms</a> and <a href={publicPageUrl("/support")} target={nativeMode ? "_blank" : undefined} rel={nativeMode ? "noreferrer" : undefined}>Support</a>.</p>}
            </>}
          </section>
        </div>
      )}
      {authReady && entryStage === "done" && syncStatus === "error" && <div role="alert" className="save-alert"><span>Some changes could not be saved. Please try again.</span><button onClick={() => setSyncStatus("idle")} aria-label="Dismiss save warning"><X/></button></div>}
      {authReady && entryStage === "done" && user && loadError && <div role="alert" className="save-alert"><span>{loadError}</span><button className="retry-load" onClick={() => setLoadRetry(value => value + 1)}>Retry</button></div>}
      {authReady && entryStage === "done" && cleanupWarning && <div role="alert" className="save-alert"><span>{cleanupWarning}</span><button onClick={() => setCleanupWarning("")} aria-label="Dismiss cleanup warning"><X/></button></div>}
    </main>
  );
}
