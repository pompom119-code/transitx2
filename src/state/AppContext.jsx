import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { initialProfiles } from '../data/mockData'
import { storageService } from '../services/storage'
import { addDays, inclusiveDays } from '../services/tripDates'
import { travelerCount, travelStyle } from '../services/profile'

const today = new Date()
const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const startDate = iso(today)

const normalizeTrip = (trip, profiles) => {
  if (!trip) return trip
  const profile = profiles.find((item) => item.id === trip.profileId)
  const days = (trip.days || []).map((day) => ({ ...day, spots: (day.spots || []).map((spot, index) => ({
    ...spot,
    location: spot.location || (trip.isDemo === false ? '位置尚未驗證' : `${trip.destination}・示範地點`),
    transportMode: spot.transportMode || (trip.isDemo === false ? '交通待確認' : index % 2 ? '步行' : '公車'),
    transportMinutes: trip.isDemo === false ? spot.transportMinutes ?? null : spot.transportMinutes || 8 + index * 5,
  })) }))
  return { ...trip, days, endDate: trip.startDate && days.length ? addDays(trip.startDate, days.length - 1) : '', travelerCount: trip.travelerCount || travelerCount(profile), style: trip.style || travelStyle(profile), isDemo: trip.isDemo !== false }
}

const defaults = {
  auth: { user: null },
  profiles: initialProfiles,
  activeProfileId: 'friends',
  profileDraft: {},
  editingProfileId: null,
  tripForm: { destination: '', startDate, endDate: addDays(startDate, 3), days: 4, travelerCount: null, places: [], optionalNotes: '', dateUnknown: false },
  currentTrip: null,
  savedTrips: [],
  favorites: { routes: [], stops: [], destinations: [] },
  random: { category: '全部', current: null, active: null },
  settings: { theme: 'light', notifications: true, transitPreference: '最快抵達', fontSize: 'medium', syncStatus: '已儲存在此裝置' },
  reminder: null,
  favoriteLabels: {},
}

const AppStateContext = createContext(null)
const AppActionsContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'AUTH_SET': return { ...state, auth: { user: action.user } }
    case 'PROFILE_SELECT': return { ...state, activeProfileId: action.id, tripForm: { ...state.tripForm, travelerCount: null } }
    case 'PROFILE_DRAFT_SET': return { ...state, profileDraft: { ...state.profileDraft, [action.key]: action.value } }
    case 'PROFILE_EDIT': {
      const profile = state.profiles.find((item) => item.id === action.id)
      return { ...state, activeProfileId: action.id, editingProfileId: action.id, profileDraft: profile?.answers || {} }
    }
    case 'PROFILE_RESTART': return { ...state, activeProfileId: action.id || state.activeProfileId, editingProfileId: action.id || state.editingProfileId, profileDraft: {} }
    case 'PROFILE_RESET': return { ...state, profileDraft: {}, editingProfileId: null }
    case 'PROFILE_COMPLETE': {
      const existing = state.profiles.find((item) => item.id === state.editingProfileId)
      const profile = {
        id: existing?.id || `profile-${Date.now()}`,
        name: action.name || existing?.name || '我的旅行設定',
        summary: action.summary,
        answers: state.profileDraft,
        preset: false,
      }
      const profiles = existing ? state.profiles.map((item) => item.id === existing.id ? profile : item) : [profile, ...state.profiles]
      return { ...state, profiles, activeProfileId: profile.id, editingProfileId: null }
    }
    case 'TRIP_FORM_SET': return { ...state, tripForm: { ...state.tripForm, ...action.value } }
    case 'TRIP_SET': return { ...state, currentTrip: action.trip }
    case 'TRIP_UPDATE': return { ...state, currentTrip: action.trip }
    case 'TRIP_SAVE': {
      if (!state.currentTrip) return state
      const savedTrips = state.savedTrips.some((item) => item.id === state.currentTrip.id)
        ? state.savedTrips.map((item) => item.id === state.currentTrip.id ? state.currentTrip : item)
        : [state.currentTrip, ...state.savedTrips]
      return { ...state, savedTrips }
    }
    case 'TRIP_OPEN': return { ...state, currentTrip: action.trip }
    case 'FAVORITE_TOGGLE': {
      const current = state.favorites[action.kind] || []
      const next = current.includes(action.id) ? current.filter((id) => id !== action.id) : [...current, action.id]
      return { ...state, favorites: { ...state.favorites, [action.kind]: next }, favoriteLabels:action.label?{...state.favoriteLabels,[action.id]:action.label}:state.favoriteLabels }
    }
    case 'RANDOM_SET': return { ...state, random: { ...state.random, ...action.value } }
    case 'SETTING_SET': return { ...state, settings: { ...state.settings, [action.key]: action.value, syncStatus: '已儲存在此裝置' } }
    case 'REMINDER_SET': return { ...state, reminder: action.value }
    default: return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, defaults, (value) => {
    const stored = storageService.load() || {}
    const profiles = stored.profiles || value.profiles
    const tripForm = { ...value.tripForm, ...stored.tripForm }
    if (!tripForm.dateUnknown) tripForm.days = inclusiveDays(tripForm.startDate, tripForm.endDate) || Math.max(1, Number(tripForm.days) || 4)
    else tripForm.days = Math.max(1, Math.min(14, Number(tripForm.days) || 4))
    return {
      ...value,
      ...stored,
      profiles,
      auth: { user: stored.auth?.user?.provider === 'google' ? null : stored.auth?.user?.provider === 'email' ? { ...stored.auth.user, provider: 'demo-email' } : stored.auth?.user || null },
      favorites: { ...value.favorites, ...stored.favorites },
      random: { ...value.random, ...stored.random },
      settings: { ...value.settings, ...stored.settings, syncStatus: '已儲存在此裝置' },
      tripForm,
      currentTrip: normalizeTrip(stored.currentTrip, profiles),
      savedTrips: (stored.savedTrips || []).map((trip) => normalizeTrip(trip, profiles)),
    }
  })
  useEffect(() => { storageService.save(state) }, [state])
  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme
    document.documentElement.dataset.font = state.settings.fontSize
  }, [state.settings.theme, state.settings.fontSize])
  const actions = useMemo(() => ({ dispatch }), [])
  return <AppStateContext.Provider value={state}><AppActionsContext.Provider value={actions}>{children}</AppActionsContext.Provider></AppStateContext.Provider>
}

export const useAppState = () => useContext(AppStateContext)
export const useAppActions = () => useContext(AppActionsContext)
