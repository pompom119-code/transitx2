import { AnimatePresence, motion } from 'framer-motion'
import React, { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function Icon({ name, size = 24 }) {
  const paths = {
    home: <><path d="m3.5 10.5 8.5-7 8.5 7v9a1 1 0 0 1-1 1h-5v-6h-4v6h-5a1 1 0 0 1-1-1z" /></>,
    ai: <><path d="M12 2.8c.7 4.8 2.7 6.8 7.5 7.5-4.8.7-6.8 2.7-7.5 7.5-.7-4.8-2.7-6.8-7.5-7.5C9.3 9.6 11.3 7.6 12 2.8Z" /><path d="M19.2 3.2c.2 1.4.8 2 2.2 2.2-1.4.2-2 .8-2.2 2.2-.2-1.4-.8-2-2.2-2.2 1.4-.2 2-.8 2.2-2.2Z" /></>,
    bus: <><rect x="5" y="3" width="14" height="15" rx="3" /><path d="M7.5 7h9M8 18v2m8-2v2M8.5 14h.01m7-.01h.01" /></>,
    wander: <><path d="m12 2.8 8 4.6v9.2l-8 4.6-8-4.6V7.4zM4.3 7.5 12 12l7.7-4.5M12 12v9" /><path d="m8.3 5.1 7.7 4.6" /></>,
    profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5.5 21v-2a6.5 6.5 0 0 1 13 0v2" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4m8-4v4M3 10h18" /></>,
    heart: <><path d="M20.8 5.8a5.2 5.2 0 0 0-7.4 0L12 7.2l-1.4-1.4a5.2 5.2 0 1 0-7.4 7.4L12 22l8.8-8.8a5.2 5.2 0 0 0 0-7.4Z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21h-4v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21v4h-.08a1.7 1.7 0 0 0-1.52 1Z" /></>,
    arrow: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    refresh: <><path d="M20 6v5h-5M4 18v-5h5" /><path d="M18.2 9A7 7 0 0 0 6 6.8L4 9m2 6a7 7 0 0 0 12 2.2L20 15" /></>,
    route: <><circle cx="6" cy="5" r="2" /><circle cx="18" cy="19" r="2" /><path d="M6 7v4c0 2 2 3 4 3h4c2 0 4 1 4 3" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
    sliders: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    star: <><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" /></>,
    briefcase: <><rect x="4" y="7" width="16" height="12" rx="2" /><path d="M9 7V5h6v2M4 12h16M10 12v2h4v-2" /></>,
    scan: <><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" /><path d="M7 12h10" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.ai}</svg>
}

function StatusBar() {
  return <div className="status-bar" aria-hidden="true"><time>9:41</time><span>▮▮▮　⌁　▰</span></div>
}

export function AppPage({ children, active = '', nav = false, className = '' }) {
  return <motion.section className={`app-page ${className}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: .2 }}>
    <StatusBar /><div className="page-scroll">{children}</div>{nav && <BottomNavigation active={active} />}
  </motion.section>
}

export function BackButton({ fallback = '/', label = '返回', preferFallback = false }) {
  const navigate = useNavigate()
  return <motion.button type="button" className="icon-button" aria-label={label} onClick={() => preferFallback || window.history.length <= 1 ? navigate(fallback, { replace: true }) : navigate(-1)} whileTap={{ scale: .94 }}><span aria-hidden="true">‹</span></motion.button>
}

export function PageHeader({ title, subtitle = '', back = true, fallback = '/', action = null }) {
  return <header className="page-header">{back ? <BackButton fallback={fallback} /> : <span className="header-spacer" />}<div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="header-action">{action}</div></header>
}

export function BottomNavigation({ active }) {
  const navigate = useNavigate()
  const items = [['home','首頁','home','/'],['ai','AI 旅遊','ai','/ai'],['traffic','交通','bus','/traffic'],['wander','亂晃','wander','/wander'],['profile','我的','profile','/me']]
  return <nav className="bottom-navigation" aria-label="主要導覽">{items.map(([key,label,icon,path]) => <motion.button type="button" key={key} aria-current={active === key ? 'page' : undefined} className={active === key ? 'active' : ''} onClick={() => navigate(path)} whileTap={{ scale: .95 }}><Icon name={icon} /><span>{label}</span></motion.button>)}</nav>
}

export function SectionHeader({ title, action = '', onAction = undefined }) {
  return <div className="section-header"><h2>{title}</h2>{action && <button type="button" onClick={onAction}>{action}<span>›</span></button>}</div>
}

export function PrimaryButton({ children, onClick = undefined, disabled = false, type = 'button', className = '' }) {
  const buttonType = type === 'submit' || type === 'reset' ? type : 'button'
  return <motion.button type={buttonType} className={`primary-button ${className}`} disabled={disabled} onClick={onClick} whileTap={disabled ? undefined : { scale: .985 }}>{children}</motion.button>
}

export function SecondaryButton({ children, onClick, className = '', disabled = false }) {
  return <motion.button type="button" className={`secondary-button ${className}`} disabled={disabled} onClick={onClick} whileTap={disabled ? undefined : { scale: .98 }}>{children}</motion.button>
}

export function FavoriteButton({ active, onClick, label = '收藏' }) {
  return <motion.button type="button" className={`favorite-button ${active ? 'active' : ''}`} aria-label={active ? `取消${label}` : label} aria-pressed={active} onClick={onClick} whileTap={{ scale: .78 }}><Icon name="heart" size={21} /></motion.button>
}

export function TabBar({ tabs, active, onChange, label = '頁籤' }) {
  return <div className="tab-bar" role="tablist" aria-label={label}>{tabs.map((tab) => <button type="button" role="tab" aria-selected={active === tab} className={active === tab ? 'active' : ''} key={tab} onClick={() => onChange(tab)}>{tab}</button>)}</div>
}

export function SearchInput({ initial = '', value: controlled = undefined, onChange = undefined, onSearch, placeholder = '搜尋公車路線、站牌', suggestions = ['666','795','石碇高中','台北車站'], autoFocus = false, appearance = 'default' }) {
  const [internal, setInternal] = useState(initial)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef(null)
  const value = controlled ?? internal
  const setValue = (next) => { setInternal(next); onChange?.(next) }
  const filtered = useMemo(() => suggestions.filter((item) => !value || item.includes(value)).slice(0,4), [suggestions, value])
  const submit = (event) => { event.preventDefault(); if (value.trim()) onSearch(value.trim()) }
  const special = appearance === 'home' || appearance === 'traffic' || appearance === 'clear'
  return <div className={`search-wrap search-${appearance}`}><form className="search-input" onSubmit={submit}><Icon name="search" /><input ref={inputRef} autoFocus={autoFocus} value={value} onChange={(event) => setValue(event.target.value)} onFocus={() => setFocused(true)} onBlur={() => window.setTimeout(() => setFocused(false),120)} placeholder={placeholder} aria-label={placeholder} />{special ? <button type="button" className="search-filter" aria-label={appearance==='clear'?'清除搜尋':value.trim()?'搜尋':'聚焦搜尋欄'} onClick={() => appearance==='clear'?(setValue(''),inputRef.current?.focus()):value.trim()?onSearch(value.trim()):inputRef.current?.focus()}><Icon name={appearance==='home'?'sliders':appearance==='traffic'?'scan':'close'} size={23} /></button> : <button type="submit" disabled={!value.trim()}>搜尋</button>}</form>
    <AnimatePresence>{focused && value && <motion.div className="suggestion-menu" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>{filtered.length ? filtered.map((item) => <button type="button" key={item} onClick={() => { setValue(item); onSearch(item) }}><Icon name="search" size={17} />{item}</button>) : <p>沒有符合的建議</p>}</motion.div>}</AnimatePresence>
  </div>
}

export function BottomSheet({ open, title, onClose, children }) {
  return <AnimatePresence>{open && <div className="sheet-layer"><motion.button type="button" className="sheet-backdrop" aria-label="關閉" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.section className="bottom-sheet" role="dialog" aria-modal="true" aria-label={title} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type:'spring', damping:28, stiffness:330 }}><div className="sheet-handle" /><header><h2>{title}</h2><button type="button" className="icon-button" aria-label="關閉" onClick={onClose}><Icon name="close" /></button></header>{children}</motion.section></div>}</AnimatePresence>
}

export function Toast({ message, actionLabel = '', onAction = undefined }) {
  return <AnimatePresence>{message && <motion.div className="toast" role="status" initial={{ opacity:0,y:16,x:'-50%' }} animate={{ opacity:1,y:0,x:'-50%' }} exit={{ opacity:0,y:10,x:'-50%' }}><span>{message}</span>{actionLabel && <button type="button" onClick={onAction}>{actionLabel}</button>}</motion.div>}</AnimatePresence>
}

export function SkeletonList({ rows = 4 }) { return <div className="skeleton-list" aria-label="載入中">{Array.from({length:rows},(_,index)=><div className="skeleton-row" key={index} />)}</div> }

export function EmptyState({ title, detail, action = '', onAction = undefined }) { return <div className="empty-state"><span>✦</span><strong>{title}</strong><p>{detail}</p>{action && <SecondaryButton onClick={onAction}>{action}</SecondaryButton>}</div> }
