import { AnimatePresence, motion } from 'framer-motion'
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppPage, BackButton, BottomSheet, EmptyState, FavoriteButton, Icon, PageHeader, PrimaryButton, SearchInput, SecondaryButton, SectionHeader } from '../components/Ui'
import { setupSteps } from '../data/mockData'
import { aiPlanner, plannerSteps } from '../services/aiPlanner'
import { localCapability } from '../services/ai/localModel.js'
import { friendlyPlanningError } from '../services/ai/errors.js'
import { answerText, isPresetProfile, profileSummary, travelerCount, travelStyle } from '../services/profile'
import { addDays, inclusiveDays, tripFormError } from '../services/tripDates'
import { useAppActions, useAppState } from '../state/AppContext'

import { NearbyStops } from '../components/BusData'

const profileCardDetails = {
  friends: { tagline:'和好朋友一起出發！' },
  couple: { tagline:'一起去喜歡的地方' },
  solo: { tagline:'出發！探索更多可能' },
  family: { tagline:'和家人一起創造回憶' },
}

function TravelProfileCard({ profile, active, tone, onUse, onManage }) {
  const rawInterests = profile.answers?.interests
  const interests = Array.isArray(rawInterests) ? rawInterests : Array.isArray(rawInterests?.selected) ? rawInterests.selected : typeof rawInterests === 'string' ? [rawInterests] : []
  const fallbackRows = [['profile',`${travelerCount(profile)} 人・${answerText(profile.answers?.companions,'旅行夥伴')}`],['heart',interests.join('、') || '依喜好規劃'],['budget',`預算　${answerText(profile.answers?.budget,'彈性')}`]]
  const details = { tagline:profileCardDetails[profile.id]?.tagline || '你的專屬旅行方式', rows:fallbackRows }
  return <motion.article className={`travel-profile-card tone-${tone} ${active ? 'active' : ''}`} whileTap={{ scale:.985 }}>
    <button type="button" className="profile-card-main" onClick={onUse}><span className="profile-card-copy"><strong>{profile.name}</strong><small>{details.tagline}</small>{isPresetProfile(profile)&&<small className="preset-label">預設範例</small>}</span><span className="profile-detail-list">{details.rows.map(([icon,text])=><small key={text}><Icon name={icon==='budget'?'route':icon} size={14}/>{text}</small>)}</span></button>
    <button type="button" className="profile-more" aria-label={`管理${profile.name}`} onClick={onManage}><Icon name="more" /></button>
    {active && <span className="selected-badge"><Icon name="check" size={15} /></span>}
  </motion.article>
}

function DestinationCard({ city, tags, tone, selected, favorite, onSelect, onFavorite }) {
  return <motion.article className={`destination-card city-${tone} ${selected ? 'selected' : ''}`} whileTap={{ scale:.985 }}>
    <button type="button" className="destination-main" onClick={onSelect}><span className="destination-code">{tone.toUpperCase().slice(0,3)}</span><strong>{city}</strong><small>{tags}</small></button>
    <FavoriteButton active={favorite} onClick={onFavorite} label={`${city}目的地`} />
  </motion.article>
}

export function HomePage() {
  const navigate = useNavigate()
  const state = useAppState()
  const search = (query) => navigate(`/traffic/search?q=${encodeURIComponent(query)}`)

  const quickSearches = [
    ['307','bus'], ['台北車站','bus'], ['石碇高中','pin'], ['666','clock'],
  ]
  const favoriteStops = state.favorites.stops.map((id) => ({ id, stop: {name:state.favoriteLabels?.[id]||'已收藏站牌'} }))
  return <AppPage active="home" nav className="home-page">
    <div className="home-brand-row"><span className="brand-wordmark">Transit<span>X</span><small>MOVE YOUR WAY</small></span><button type="button" className="avatar-button" onClick={() => navigate('/me')} aria-label="開啟我的"><Icon name="profile" /></button></div>
    <section className="home-hero"><h1>下一站，<br/><span>去哪探索？</span></h1><p>查公車、站牌、即時到站，出發更簡單。</p></section>
    <SearchInput appearance="home" placeholder="搜尋公車路線、站牌" onSearch={search} />
    <div className="quick-chips">{quickSearches.map(([item, icon]) => <button type="button" key={item} onClick={() => search(item)}><Icon name={icon} size={17}/>{item}</button>)}</div>
    <div className="home-section-head"><h2>附近交通</h2><span><Icon name="pin" size={17}/>需要定位授權</span><button type="button" onClick={() => navigate('/traffic')}>查看全部 <i>›</i></button></div>
    <NearbyStops city={state.settings.busCity||'TaipeiMetro'}/>
    <SectionHeader title="常用站牌" action="編輯" onAction={() => navigate('/me?section=favorites')} />
    {favoriteStops.length?<div className="favorite-stop-grid">{favoriteStops.slice(0,3).map(({id,stop})=><button type="button" key={id} onClick={()=>navigate(`/traffic/stops/${id}`)}><Icon name="star"/><span><strong>{stop.name}</strong><small>已收藏站牌</small></span><i>›</i></button>)}</div>:<p className="home-empty-favorites">還沒有常用站牌。到站牌頁點收藏，就能在這裡快速開啟。</p>}
    <SectionHeader title="更多功能" />
    <div className="feature-grid"><motion.button type="button" className="feature-card ai-card" onClick={()=>navigate('/ai')} whileTap={{scale:.98}}><span className="feature-eyebrow">AI PLANNER <Icon name="ai" size={18}/></span><strong>AI 旅遊</strong><small>用 AI 規劃<br/>你的專屬行程</small><i aria-hidden="true">↗</i></motion.button><motion.button type="button" className="feature-card wander-card" onClick={()=>navigate('/wander')} whileTap={{scale:.98}}><span className="feature-eyebrow">RANDOM <Icon name="wander" size={18}/></span><strong>亂晃</strong><small>今天不知道去哪？<br/>抽一張就走。</small><i aria-hidden="true">↗</i></motion.button></div>
  </AppPage>
}

export function AiHomePage({ notify }) {
  const navigate = useNavigate(); const state = useAppState(); const { dispatch } = useAppActions(); const [managed,setManaged]=useState(null)
  const visibleProfiles = state.profiles
  const activeProfile = state.profiles.find((item) => item.id === state.activeProfileId)
  const choose=(profile)=>{dispatch({type:'PROFILE_SELECT',id:profile.id});navigate('/ai/new')}
  return <AppPage active="ai" nav className="ai-home-page">
    <div className="ai-home-top"><span className="brand-wordmark">Transit<span>X</span><small>AI TRAVEL</small></span><button type="button" className="avatar-button" onClick={()=>navigate('/me')} aria-label="開啟我的"><Icon name="profile"/></button></div>
    <section className="ai-home-hero"><div><span className="editorial-kicker">PLAN YOUR NEXT JOURNEY / 01</span><h1>用 AI，<br/><span>規劃屬於你的旅程</span></h1><p>建立你的旅行設定，讓每一次出發都更簡單。</p></div></section>
    <motion.button type="button" className="new-trip-cta" onClick={()=>navigate('/ai/new')} whileTap={{scale:.985}}><span className="cta-icon"><Icon name="ai"/></span><span><strong>開始規劃新旅程</strong><small>目前使用：{activeProfile?.name || '尚未選擇設定'}{isPresetProfile(activeProfile) ? '（預設）' : ''}・可點下方卡片切換</small></span><i><Icon name="arrow"/></i></motion.button>
    <SectionHeader title="旅行設定" action="管理" onAction={()=>setManaged(activeProfile)}/>
    <div className="profile-grid">{visibleProfiles.map((profile,index)=><TravelProfileCard key={profile.id} profile={profile} tone={index%4+1} active={state.activeProfileId===profile.id} onUse={()=>choose(profile)} onManage={()=>setManaged(profile)}/>)}</div>
    <div className="add-profile-row"><button type="button" className="add-profile-card" onClick={()=>{dispatch({type:'PROFILE_RESET'});navigate('/ai/setup/1')}}><span>＋</span><strong>新增旅行設定</strong><small>回答幾個問題，建立專屬於你的旅行風格</small></button></div>
    <BottomSheet open={Boolean(managed)} title={managed?.name || '旅行設定'} onClose={()=>setManaged(null)}><p className="sheet-summary">{isPresetProfile(managed) ? '預設範例・' : '你建立的設定・'}{profileSummary(managed?.answers)}</p><div className="profile-sheet-details">{[['同行', 'companions'], ['興趣', 'interests'], ['探索', 'exploration'], ['移動', 'transport'], ['步行', 'walking'], ['預算', 'budget'], ['節奏', 'pace'], ['備註', 'notes']].map(([label,key])=><p key={key}><strong>{label}</strong><span>{answerText(managed?.answers?.[key])}</span></p>)}</div><PrimaryButton onClick={()=>choose(managed)}>使用此設定開始旅行</PrimaryButton><SecondaryButton onClick={()=>{dispatch({type:'PROFILE_EDIT',id:managed.id});navigate('/ai/setup/1')}}>編輯設定</SecondaryButton><SecondaryButton onClick={()=>{dispatch({type:'PROFILE_RESTART',id:managed.id});notify('已清空答案，可以重新設定');navigate('/ai/setup/1')}}>重新設定</SecondaryButton></BottomSheet>
  </AppPage>
}

const setupQuestions=[['通常，','誰和你一起出發？'],['旅行時，','你最喜歡什麼？'],['你想走多遠','出舒適圈？'],['你偏好','怎麼移動？'],['一天可以','走多少路？'],['這次旅行的','預算大約是？'],['你喜歡什麼樣的','行程節奏？'],['還有什麼','想告訴我嗎？']]
const setupHints=['約 2 分鐘完成，之後都可以修改。選擇最符合這組旅行設定的同行對象。','可以多選，選出讓你覺得旅行更快樂的事。','這題決定景點類型；行程快慢會在第 7 題設定。','選擇你最常使用或最喜歡的交通方式（可複選）。','選擇一天能接受的步行距離。','以新台幣計價，每人每天活動與餐飲預算，不含住宿；海外行程依模型估算，請自行確認價格。','只選每天的出發與休息節奏，不用重選景點類型。','有飲食、無障礙或時間限制再填；沒有也可以直接完成。']
const setupCardCopy=[
  [
    ['自己','一個人也可以很精彩',['自由','隨性','探索']],['朋友','和好朋友一起出發！',['熱鬧','美食','拍照']],['情侶','和喜歡的人看更多風景',['約會','浪漫','放鬆']],['家人','和家人一起創造回憶',['輕鬆','安全','多元']],
  ],
  [
    ['美食','吃遍當地美食',[]],['拍照','記錄每個畫面',[]],['自然','山海、戶外、風景',[]],['逛街','購物、市集、商圈',[]],['文化','博物館、古蹟、人文',[]],['活動','音樂、展覽、節慶',[]],['咖啡','咖啡廳、甜點、午後時光',[]],['運動','健行、跑步、戶外活動',[]],['放鬆','耍廢、泡湯、慢旅行',[]],
  ],
  [
    ['經典派','第一次去就該去的地方',['熱門景點','經典地標','不踩雷']],['在地派','體驗在地人會去的地方',['特色小店','在地美食','日常風景']],['探索派','小眾、有特色、願意繞點路',['秘境景點','深度體驗','特色文化']],['冒險派','不要告訴我，帶我去就對了',['非常小眾','意外驚喜','獨特體驗']],
  ],
  [
    ['公車','深入城市各個角落',['路線多','看見不同風景','價格實惠']],['步行','用雙腳慢慢感受城市',['深入體驗','發現驚喜','更貼近當地']],['計程車','市區點對點移動',['不需轉乘','行李方便','費用較高']],['租車','自行駕駛前往郊區',['行程自由','需停車','適合郊區']],['接駁車','舒適銜接指定景點',['快速移動','舒適方便','定點接駁']],['觀光巴士','用公車探索更多城市',['經典路線','輕鬆移動','沿途風景']],
  ],
  [
    ['輕鬆走','走一走、停一停，舒服最重要',['每天 0–5 公里','較多休息','適合放鬆行程']],['適中走','可以走比較多路，景點慢慢逛',['每天 5–10 公里','適量休息','大多數行程適用']],['耐走派','走再多都沒問題！想多看多體驗',['每天 10–15 公里','行程緊湊','適合深度探索']],['隨緣就好','看心情決定，能少走就少走',['不固定','容易疲累','以舒適為主']],
  ],
  [
    ['小資輕鬆','NT$ 500 以下',['省錢也能玩','平價美食','不含住宿']],['經濟實用','NT$ 500 – 1,000',['高 CP 值','在地美食','不含住宿']],['標準享受','NT$ 1,000 – 2,000',['豐富體驗','特色餐廳','不含住宿']],['高品質旅遊','NT$ 2,000 – 3,500',['舒適便利','精緻美食','不含住宿']],['奢華放鬆','NT$ 3,500 以上',['高預算體驗','餐飲彈性','不含住宿']],['自訂預算','輸入每人每天預算',['彈性規劃','依需求調整','不含住宿']],
  ],
  [
    ['充實探索','想把想去的都排進去！',['早出晚歸','節奏緊湊','活動較多']],['悠閒放鬆','慢慢走、慢慢玩，享受當下',['景點適中','休息較多','不趕行程']],['早起出發','早點開始，下午留給自己',['早晨活動','避開人潮','下午彈性']],['晚起慢遊','睡飽再出發，晚上多看看',['上午放慢','晚間活動','步調從容']],['彈性隨性','沒有太多計畫，走到哪玩到哪',['保留空檔','隨時調整','享受驚喜']],
  ],
  [
    ['特定日期／時間','有需要避開的時段',['預約時間','固定活動','時間限制']],['寵物同行','會帶寵物一起旅行',['寵物友善','休息需求','同行安排']],['特殊飲食／無障礙','餐飲或行動上的限制',['過敏注意','無障礙設施','素食需求']],['其他想法','任何尚未提到的需求',[]],
  ],
]

export function SetupPage() {
  const {step='1'}=useParams(); const navigate=useNavigate(); const state=useAppState(); const {dispatch}=useAppActions(); const index=Math.min(7,Math.max(0,Number(step)-1)); const config=setupSteps[index]; const value=state.profileDraft[config.key]
  const customMode=[1,3,5,7].includes(index); const inlineCustom=[5,7].includes(index); const [custom,setCustom]=useState(typeof value==='object'&&!Array.isArray(value)?value.text||'':''); const selected=Array.isArray(value)?value:typeof value==='object'?value.selected||[]:value?[value]:[]
  const store=(next,text=custom)=>dispatch({type:'PROFILE_DRAFT_SET',key:config.key,value:customMode||config.type==='custom'?{selected:next,text}:config.type==='single'?next[0]||'':next})
  const toggle=(option)=>{const next=config.type==='single'?[option]:selected.includes(option)?selected.filter(item=>item!==option):[...selected,option];store(next)}
  const updateCustom=(text)=>{setCustom(text);const last=config.options.at(-1);const next=inlineCustom&&text.trim()?(config.type==='single'?[last]:selected.includes(last)?selected:[...selected,last]):selected;store(next,text)}
  const valid=index===7||selected.length>0||Boolean(custom.trim())
  const next=()=>{if(!valid)return;if(index<7)navigate(`/ai/setup/${index+2}`);else{dispatch({type:'PROFILE_COMPLETE',name:state.editingProfileId?undefined:'我的旅行設定',summary:profileSummary(state.profileDraft)});navigate('/ai/setup-complete')}}
  const cardCopy=setupCardCopy[index]
  return <AppPage className={`setup-page setup-step-${index+1}`}><header className="setup-topbar">{index>0?<BackButton fallback="/ai"/>:<span/>}<div><div className="progress-dots">{setupSteps.map((_,dot)=><span key={dot} className={dot<=index?'active':''}/>)}</div><small>{String(index+1).padStart(2,'0')} / 08</small></div><button type="button" className="setup-close" aria-label="關閉旅行設定" onClick={()=>navigate('/ai')}><Icon name="close"/></button></header>
    <section className="setup-intro"><span className="editorial-kicker">TRAVEL PREFERENCES / {String(index+1).padStart(2,'0')}</span><h1>{setupQuestions[index][0]}<br/><em>{setupQuestions[index][1]}</em></h1><p>{setupHints[index]}</p></section>
    <div className={`preference-grid count-${config.options.length}`} role="group" aria-label={config.title}>{config.options.map((option,optionIndex)=>{const visual=cardCopy[optionIndex];const title=String(visual[0]);const description=String(visual[1]);const tags=Array.isArray(visual[2])?visual[2]:[];const chosen=selected.includes(option);const showInput=inlineCustom&&optionIndex===config.options.length-1;return <motion.article key={option} className={`preference-card tone-${(optionIndex%4)+1} ${chosen?'selected':''}`} whileTap={{scale:.985}}><button type="button" className="preference-card-select" aria-pressed={chosen} onClick={()=>toggle(option)}><span className="preference-copy"><span className="option-index">{String(optionIndex+1).padStart(2,'0')}</span><strong>{title}</strong><small>{description}</small>{tags.length>0&&<span>{tags.map(tag=><i key={tag}>{tag}</i>)}</span>}</span><b className="selection-ring">{chosen&&<Icon name="check" size={14}/>}</b></button>{showInput&&<input aria-label={title} value={custom} onChange={event=>updateCustom(event.target.value)} placeholder={index===5?'輸入每人每天預算':'例如：慶生、求婚、畢業旅行…'}/>}</motion.article>})}</div>
    {customMode&&!inlineCustom&&<label className="setup-custom-strip"><Icon name={index===1?'route':'ai'} size={24}/><span>其他{index===1?'喜好':'方式'}（選填）</span><input value={custom} maxLength={80} placeholder={index===1?'例如：動漫、建築、寵物友善等…':'例如：機車、包車、旅遊巴士…'} onChange={event=>updateCustom(event.target.value)}/></label>}
    <div className="setup-encouragement"><span className="tip-icon"><Icon name="ai" size={22}/></span><p><strong>{index===7?'太棒了！':'之後還可以再調整'}</strong><small>{index===7?'你的旅行設定即將完成。':'每個答案都會幫助我們安排更適合你的行程。'}</small></p></div>
    <div className="setup-footer"><PrimaryButton disabled={!valid} onClick={next}>{index===7?(selected.length||custom.trim()?'完成設定':'略過並完成'):'繼續'} <Icon name="arrow" size={20}/></PrimaryButton></div>
  </AppPage>
}

export function SetupDonePage() {
  const navigate=useNavigate(); const state=useAppState(); const {dispatch}=useAppActions(); const profile=state.profiles.find(item=>item.id===state.activeProfileId)
  const answers=profile?.answers||{}
  const text=(key,fallback='未設定')=>answerText(answers[key],fallback)
  const details=[['profile','同行對象',text('companions'),'mint'],['heart','興趣喜好',text('interests'),'pink'],['route','探索程度',text('exploration'),'yellow'],['bus','交通方式',text('transport'),'blue'],['route','步行程度',text('walking'),'pink'],['briefcase','預算範圍',text('budget'),'mint'],['sliders','行程節奏',text('pace'),'violet'],['ai','其他需求',text('notes','沒有其他需求'),'yellow']]
  return <AppPage className="setup-done-page"><header className="setup-topbar"><BackButton fallback="/ai"/><div><div className="progress-dots">{setupSteps.map((_,dot)=><span key={dot} className="active"/>)}</div><small>08 / 08</small></div><button type="button" className="setup-close" aria-label="關閉旅行設定" onClick={()=>navigate('/ai')}><Icon name="close"/></button></header><section className="done-hero"><span className="editorial-kicker">PROFILE COMPLETE / 08</span><div><h1>太棒了！<br/>你的旅行設定<span>已完成</span></h1><p>這是你的專屬旅行風格，<br/>接下來可以用這些偏好建立專屬行程。</p></div></section><article className="travel-pass"><header><span><Icon name="ai"/><strong>你的旅行設定卡</strong><button type="button" aria-label="編輯設定" onClick={()=>{dispatch({type:'PROFILE_EDIT',id:profile?.id});navigate('/ai/setup/1')}}><Icon name="route" size={18}/></button></span><small>TRAVEL MODE　◎</small></header><section className="travel-pass-feature"><div><span className="editorial-kicker">YOUR TRAVEL STYLE</span><h2>{travelStyle(profile)}</h2><p>依照你的八題回答建立，<br/>之後仍可隨時調整。</p></div></section><div className="travel-pass-grid">{details.map(([icon,label,value,tone])=><button type="button" key={label} className={`pass-detail ${tone}`} onClick={()=>{dispatch({type:'PROFILE_EDIT',id:profile?.id});navigate('/ai/setup/1')}}><span><Icon name={icon} size={20}/></span><span><strong>{label}</strong><small>{value}</small></span><i>›</i></button>)}</div><footer><Icon name="map"/><span>這不只是一趟旅行，<br/>而是屬於你的故事。</span><em>A Trip<br/>Made for You.</em></footer></article><div className="done-secondary-actions"><button type="button" onClick={()=>{dispatch({type:'PROFILE_RESTART',id:profile?.id});navigate('/ai/setup/1')}}><Icon name="refresh"/>重新填寫</button><button type="button" onClick={()=>{dispatch({type:'PROFILE_EDIT',id:profile?.id});navigate('/ai/setup/1')}}><Icon name="route"/>編輯設定</button></div><PrimaryButton className="done-start-button" onClick={()=>navigate('/ai/new')}>用這個設定開始旅行 <Icon name="arrow"/></PrimaryButton></AppPage>
}

export function TripFormPage() {
  const navigate=useNavigate(); const state=useAppState(); const {dispatch}=useAppActions(); const form=state.tripForm; const [place,setPlace]=useState(''); const [destinationFocused,setDestinationFocused]=useState(false); const [destinationOffset,setDestinationOffset]=useState(0); const update=value=>dispatch({type:'TRIP_FORM_SET',value})
  const setDates=(key,date)=>{const next={...form,[key]:date};next.days=inclusiveDays(next.startDate,next.endDate)||form.days;update(next)}
  const addPlace=()=>{const name=place.trim();if(!name||form.places.includes(name)||form.places.length>=14)return;update({places:[...form.places,name]});setPlace('')}
  const destinations=[['東京','美食・購物・文化','tokyo'],['大阪','美食・景點・購物','osaka'],['首爾','美食・潮流・購物','seoul'],['台北','美食・文創・自然','taipei']]
  const rotatedDestinations=[...destinations.slice(destinationOffset),...destinations.slice(0,destinationOffset)]
  const citySuggestions=['東京','大阪','首爾','台北','京都','福岡'].filter(city=>!form.destination||city.includes(form.destination)).slice(0,4)
  const setDays=(days)=>{const safeDays=Math.max(1,Math.min(14,days));if(form.dateUnknown||!form.startDate){update({days:safeDays});return}update({days:safeDays,endDate:addDays(form.startDate,safeDays-1)})}
  const dateError=!form.dateUnknown&&form.startDate&&form.endDate
    ?form.endDate<form.startDate?'回程日期不能早於出發日期。':inclusiveDays(form.startDate,form.endDate)>14?'一次最多規劃 14 天，請縮短日期範圍。':''
    :''
  const activeProfile=state.profiles.find(p=>p.id===state.activeProfileId)
  const solo=answerText(activeProfile?.answers?.companions)==='自己'
  const people=solo?1:(form.travelerCount??travelerCount(activeProfile))
  const valid=!tripFormError(form)&&Boolean(activeProfile)
  return <AppPage className="trip-form-page"><header className="trip-form-top"><BackButton fallback="/ai"/><button type="button" className="text-button" onClick={()=>navigate('/ai')}>稍後建立</button></header><section className="trip-form-hero"><div><span className="editorial-kicker">NEW JOURNEY / 01</span><h2>想去哪裡<br/><em>開始這趟旅行？</em></h2><p>告訴我們你想去的目的地與時間，<br/>依照你的旅行設定生成可編輯的行程。</p></div></section>
    <div className="destination-search"><label className="destination-input"><Icon name="pin"/><input aria-label="目的地" value={form.destination} onFocus={()=>setDestinationFocused(true)} onBlur={()=>window.setTimeout(()=>setDestinationFocused(false),120)} onChange={event=>update({destination:event.target.value})} placeholder="輸入城市名稱，例如東京"/><button type="button" aria-label="搜尋目的地" disabled={!form.destination.trim()} onClick={()=>{const match=citySuggestions[0];if(match)update({destination:match});setDestinationFocused(false)}}><Icon name="search"/></button></label><AnimatePresence>{destinationFocused&&form.destination&&<motion.div className="suggestion-menu" initial={{opacity:0,y:-5}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}}>{citySuggestions.length?citySuggestions.map(city=><button type="button" key={city} onClick={()=>{update({destination:city});setDestinationFocused(false)}}><Icon name="pin" size={17}/>{city}</button>):<p>按搜尋即可使用「{form.destination}」</p>}</motion.div>}</AnimatePresence></div>
    <div className="form-label-row"><h3><Icon name="calendar"/>什麼時候出發？</h3><label className="check-label"><input type="checkbox" checked={form.dateUnknown} onChange={event=>update(event.target.checked?{dateUnknown:true,days:Math.max(1,form.days)}:{dateUnknown:false,endDate:addDays(form.startDate,Math.max(1,form.days)-1)})}/><span>還不確定日期</span></label></div>
    <div className="date-card-grid"><label className={form.dateUnknown?'disabled':''}><Icon name="calendar"/><span>出發日期<input type="date" aria-label="出發日期" disabled={form.dateUnknown} value={form.startDate} onChange={event=>setDates('startDate',event.target.value)}/></span></label><label className={form.dateUnknown?'disabled':''}><Icon name="calendar"/><span>回程日期<input type="date" aria-label="回程日期" disabled={form.dateUnknown} value={form.endDate} onChange={event=>setDates('endDate',event.target.value)}/></span></label></div>
    {dateError&&<p className="trip-date-error" role="alert">{dateError}</p>}
    <div className="day-counter"><span><Icon name="profile"/><strong>這次旅行有幾天？</strong></span><div><button type="button" aria-label="減少一天" disabled={form.days<=1} onClick={()=>setDays(form.days-1)}>−</button><strong>{form.days} 天</strong><button type="button" aria-label="增加一天" disabled={form.days>=14} onClick={()=>setDays(form.days+1)}>＋</button></div></div>
    <div className="day-counter"><span><Icon name="profile"/><strong>這次有幾位同行？</strong></span><div><button type="button" aria-label="減少一人" disabled={solo||people<=1} onClick={()=>update({travelerCount:people-1})}>−</button><strong>{people} 人</strong><button type="button" aria-label="增加一人" disabled={solo||people>=20} onClick={()=>update({travelerCount:people+1})}>＋</button></div></div>
    <div className="form-label-row"><h3><Icon name="map"/>有特定地點想去嗎？</h3><small>選填</small></div><form className="specified-place-form" onSubmit={event=>{event.preventDefault();addPlace()}}><Icon name="pin"/><input aria-label="指定地點" value={place} onChange={event=>setPlace(event.target.value)} maxLength={100} placeholder="新增指定地點（最多 14 個）"/><button type="submit" disabled={!place.trim()}>新增</button></form><div className="place-chip-list">{form.places.map(item=><motion.button layout type="button" key={item} onClick={()=>update({places:form.places.filter(value=>value!==item)})}>{item}<Icon name="close" size={15}/></motion.button>)}</div>
    <label className="trip-optional-notes"><span>這次旅行還有什麼想法？ <small>選填</small></span><textarea value={form.optionalNotes||''} maxLength={500} onChange={event=>update({optionalNotes:event.target.value})} placeholder="例如：下午才出發、想保留更多自由時間"/></label>
    <SectionHeader title="推薦熱門目的地" action="換一批" onAction={()=>setDestinationOffset(value=>(value+1)%destinations.length)}/><div className="destination-grid">{rotatedDestinations.map(([city,tags,tone])=><DestinationCard key={city} city={city} tags={tags} tone={tone} selected={form.destination===city} favorite={state.favorites.destinations.includes(city)} onSelect={()=>update({destination:city})} onFavorite={()=>dispatch({type:'FAVORITE_TOGGLE',kind:'destinations',id:city})}/>)}</div>
    <p className="home-empty-favorites">{import.meta.env?.VITE_AI_RUNTIME==='local'?'此裝置的 WebGPU AI 仍是實驗功能，可能無法產生合格行程；首次需下載約 0.9 GB 模型。':'行程由 AI 依照旅行設定規劃，並查核景點資料。'}若驗證失敗，不會儲存不可靠的行程。請勿填寫敏感個資。</p>
    <PrimaryButton className="trip-form-submit" disabled={!valid} onClick={()=>navigate('/ai/loading',{replace:true})}>開始規劃行程 <Icon name="arrow"/></PrimaryButton>
  </AppPage>
}

export function LoadingPage() {
  const navigate=useNavigate(); const state=useAppState(); const {dispatch}=useAppActions(); const [step,setStep]=useState(0); const [progress,setProgress]=useState(null); const [error,setError]=useState(''); const [attempt,setAttempt]=useState(0)
  const runtime=import.meta.env?.VITE_AI_RUNTIME==='local'&&localCapability().supported?'此裝置的 WebGPU AI':'伺服器 AI'
  useEffect(()=>{let cancelled=false;const controller=new AbortController();setError('');setStep(0);setProgress(null);const profile=state.profiles.find(item=>item.id===state.activeProfileId);const start=setTimeout(()=>{aiPlanner.generateTrip(state.tripForm,profile,event=>{if(!cancelled){const value=typeof event==='number'?{step:event}:event;setStep(value.step);setProgress(value)}},controller.signal).then(trip=>{if(!cancelled){dispatch({type:'TRIP_SET',trip});navigate(`/trips/${trip.id}`,{replace:true})}}).catch(reason=>{if(!cancelled)setError(friendlyPlanningError(reason))})},0);return()=>{cancelled=true;clearTimeout(start);controller.abort()}},[attempt])
  const downloadPercent=step===0&&progress?.downloadPercent!=null?progress.downloadPercent:null
  return <AppPage className="loading-page"><section className="loading-content">
    <span className="editorial-kicker">TRANSITX / AI PLANNER</span>
    <h1><em>AI</em> 正在為你<br/>規劃行程中<span>...</span></h1>
    <p className="loading-lead">依照你的偏好，<br/>現場規劃這一次的旅程。</p>
    <p className="loading-runtime">執行方式：{runtime}</p>
    {!error?<>
      <div className={`loading-progress ${downloadPercent==null?'indeterminate':''}`}><span style={downloadPercent==null?undefined:{width:`${downloadPercent}%`}}/></div>
      {downloadPercent!=null&&<p role="status" className="loading-download">模型下載／載入 {downloadPercent}%</p>}
      <div className="planner-step-list">{plannerSteps.map((label,index)=><motion.div key={label} className={index<step?'done':index===step?'active':''} animate={{opacity:index<=step?1:.48,y:0}} initial={{opacity:0,y:8}}><i>{String(index+1).padStart(2,'0')}</i><span><strong>{index===step&&progress?.label?progress.label:label}{index===step?' ...':''}</strong><small>{[runtime==='此裝置的 WebGPU AI'?'首次使用需下載模型，之後可使用瀏覽器快取':'正在連接 AI 規劃服務','根據旅行設定制定策略','逐日建立景點、活動、餐飲與休息','景點未驗證時明確標示；不杜撰店家','核對目的地、日期與指定地點'][index]}</small></span><b>{index<step?<Icon name="check" size={18}/>:index===step?<motion.span animate={{opacity:[.3,1,.3]}} transition={{repeat:Infinity,duration:1.2}}>●</motion.span>:null}</b></motion.div>)}</div>
      <div className="loading-tip"><span><Icon name="ai" size={21}/></span><p><strong>AI 規劃進行中</strong><small>完成後將自動帶你前往行程頁面。</small></p></div>
      <SecondaryButton onClick={()=>navigate('/ai/new',{replace:true})}>取消並返回修改</SecondaryButton>
    </>:<div className="inline-error"><strong>這次沒有順利完成規劃</strong><p>{error}</p><PrimaryButton onClick={()=>setAttempt(value=>value+1)}>重新規劃</PrimaryButton><SecondaryButton onClick={()=>navigate('/ai/new')}>返回修改</SecondaryButton></div>}
  </section></AppPage>
}
