export const cities = {
 Taipei:'臺北市',NewTaipei:'新北市',Taoyuan:'桃園市',Taichung:'臺中市',Tainan:'臺南市',Kaohsiung:'高雄市',
 Keelung:'基隆市',Hsinchu:'新竹市',HsinchuCounty:'新竹縣',MiaoliCounty:'苗栗縣',ChanghuaCounty:'彰化縣',
 NantouCounty:'南投縣',YunlinCounty:'雲林縣',Chiayi:'嘉義市',ChiayiCounty:'嘉義縣',PingtungCounty:'屏東縣',
 YilanCounty:'宜蘭縣',HualienCounty:'花蓮縣',TaitungCounty:'臺東縣',PenghuCounty:'澎湖縣',KinmenCounty:'金門縣',LienchiangCounty:'連江縣',
}
export const normalizeQuery = text => String(text || '').normalize('NFKC').trim().toLowerCase().replace(/臺/g,'台')
export function rank(name, query) {
 const value=normalizeQuery(name), q=normalizeQuery(query)
 return value===q?0:value.startsWith(q)?2:value.includes(q)?3:99
}
export function etaText(item, now = Date.now()) {
 if (item.updatedAt && now-Date.parse(item.updatedAt)>180000) return '資料已過期'
 if (item.status===1) return '尚未發車'
 if (item.status===2) return '交管不停靠'
 if (item.status===3) return '末班已過'
 if (item.status===4) return '今日未營運'
 if (item.status!==0 || !Number.isFinite(item.seconds) || item.seconds<0) return '暫無預估'
 return item.seconds<=60?'即將進站':Math.ceil(item.seconds/60)+' 分'
}

