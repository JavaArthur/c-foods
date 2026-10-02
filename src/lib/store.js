import { reactive, ref, computed, watch } from 'vue'
import { localDate, allowed } from './menu'
const KEY='dinner-v1'
const defaults=()=>({settings:{servings:2,avoids:[],spicy:1,blacklist:[],classification:{}},favorites:[],history:[],today:null,checks:{},progress:{},timers:{}})
let saved
try{saved=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}
export const state=reactive({...defaults(),...saved,settings:{...defaults().settings,...saved?.settings}})
if(!Array.isArray(state.settings.avoids))state.settings.avoids=[]
for(const k of ['favorites','history'])if(!Array.isArray(state[k]))state[k]=[]
export const toast=ref('');let toastId
export function tell(text){toast.value=text;clearTimeout(toastId);toastId=setTimeout(()=>toast.value='',4500)}
watch(state,()=>{try{localStorage.setItem(KEY,JSON.stringify(state))}catch{tell('手机存储空间有点满，这次的记录可能存不下来。')}},{deep:true})
export const rawDishes=ref([]),loading=ref(true),loadError=ref(false)
export const dishes=computed(()=>rawDishes.value.map(d=>({...d,isMeat:state.settings.classification[d.id]??d.isMeat})))
export const menuIds=ref([]),lockedIds=ref([]),step=ref(1),maxStep=ref(1),menuNote=ref('')
export const menu=computed(()=>menuIds.value.map(id=>dishes.value.find(d=>d.id===id)).filter(Boolean))
export async function loadDishes(){loading.value=true;loadError.value=false;try{const r=await fetch(import.meta.env.BASE_URL+'data/dishes.json');if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data)||!data.length||!data.every(d=>d.id&&d.ingredients?.length&&d.steps?.length))throw Error();rawDishes.value=data
 if(state.today?.date===localDate()){menuIds.value=state.today.ids.filter(id=>dishes.value.some(d=>d.id===id));step.value=2;maxStep.value=4}
 }catch{loadError.value=true}finally{loading.value=false}}
export function goStep(n){if(n===1||menu.value.length){step.value=n;maxStep.value=Math.max(n,maxStep.value);window.scrollTo(0,0)}}
export function invalidate(){state.today=null;state.checks={};state.progress={};state.timers={};maxStep.value=2}
export function confirmMenu(){if(menu.value.some(d=>!allowed(d,state.settings))){tell('这桌里有不符合当前忌口的菜，换一道再确认吧。');return false}const date=localDate();const ids=[...menuIds.value];state.today={date,ids};if(!state.history.some(h=>h.date===date&&h.ids.join()===ids.join()))state.history.unshift({date,ids,servings:state.settings.servings});state.history=state.history.slice(0,90);maxStep.value=4;return true}
export function favorite(id){state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id]}
export function addDish(d){if(!allowed(d,state.settings)){tell('这道菜不符合你的忌口或辣度设置，先换一道吧。');return}if(menuIds.value.includes(d.id)){tell('这道已经在今晚菜单里啦。');return}if(menuIds.value.length>=10){tell('一桌最多 10 道，已经很丰盛啦。');return}menuIds.value.push(d.id);invalidate();goStep(2);tell('加入今晚菜单啦，记得确认这一桌。')}
export function resetAll(){Object.assign(state,defaults());menuIds.value=[];lockedIds.value=[];step.value=1;maxStep.value=1;tell('已经清空，我们从新的一餐开始。')}
