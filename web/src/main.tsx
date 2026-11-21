import React,{useEffect,useState} from 'react';
import{createRoot}from'react-dom/client';
import{createClient, type Session}from'@supabase/supabase-js';
import './style.css';
const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string|undefined;
const client=url&&key?createClient(url,key):null;
type Ingredient={name:string;quantity:string|null;unit:string|null;note:string|null};
type Recipe={id:string;title:string;description:string|null;category:string|null;tags:string[];instructions:string[];ingredients:Ingredient[];version:number};
async function api<T>(session:Session,path:string,method='GET',body?:unknown):Promise<T>{
  if(!url||!key)throw Error('Не настроено подключение к Supabase');
  const res=await fetch(url+'/functions/v1/family-recipes-web'+path,{method,headers:{Authorization:'Bearer '+session.access_token,apikey:key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await res.json();if(!res.ok)throw Error(data.error??'Ошибка сервера');return data as T;
}
function App(){
 const[session,setSession]=useState<Session|null>(null),[email,setEmail]=useState(''),[message,setMessage]=useState(''),[items,setItems]=useState<Recipe[]>([]),[selected,setSelected]=useState<Recipe|null>(null),[search,setSearch]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{client?.auth.getSession().then(({data})=>setSession(data.session));const sub=client?.auth.onAuthStateChange((_event,s)=>setSession(s));return()=>sub?.data.subscription.unsubscribe()},[]);
 useEffect(()=>{if(session)refresh(session);else{setItems([]);setSelected(null)}},[session?.access_token]);
 async function refresh(s:Session){try{setItems((await api<{recipes:Recipe[]}>(s,'/recipes')).recipes)}catch(e){setMessage(String(e))}}
 async function login(e:React.FormEvent){e.preventDefault();if(!client)return;setBusy(true);try{const{error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.href}});if(error)throw error;setMessage('Проверь почту: отправлена ссылка для входа.')}catch(e){setMessage(String(e))}finally{setBusy(false)}}
 async function open(id:string){if(!session)return;try{setSelected((await api<{recipe:Recipe}>(session,'/recipes/'+encodeURIComponent(id))).recipe);setMessage('')}catch(e){setMessage(String(e))}}
 async function save(){if(!session||!selected)return;setBusy(true);try{const{recipe}=await api<{recipe:Recipe}>(session,'/recipes/'+selected.id,'PUT',selected);setSelected(recipe);await refresh(session);setMessage('Изменения сохранены')}catch(e){setMessage(String(e))}finally{setBusy(false)}}
 const edit=(patch:Partial<Recipe>)=>setSelected(v=>v?{...v,...patch}:v);
 const ingredient=(i:number,patch:Partial<Ingredient>)=>edit({ingredients:selected!.ingredients.map((v,j)=>i===j?{...v,...patch}:v)});
 if(!client)return <main><h1>Семейные рецепты</h1><p>Укажи VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY.</p></main>;
 if(!session)return <main className="login"><h1>Семейные рецепты</h1><p>Вход только для членов семьи</p><form onSubmit={login}><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><button disabled={busy}>Получить ссылку для входа</button></form><p role="status">{message}</p></main>;
 return <main><header><h1>Семейные рецепты</h1><button className="secondary" onClick={()=>client.auth.signOut()}>Выйти</button></header><div className="layout"><aside><input aria-label="Поиск рецептов" placeholder="Поиск по названию" value={search} onChange={e=>setSearch(e.target.value)}/><p>{items.length} рецептов</p><nav>{items.filter(r=>r.title.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))).map(r=><button className={'item '+(selected?.id===r.id?'active':'')} key={r.id} onClick={()=>open(r.id)}>{r.title}</button>)}</nav></aside><section>{selected?<><label>Название<input value={selected.title} onChange={e=>edit({title:e.target.value})}/></label><label>Категория<input value={selected.category??''} onChange={e=>edit({category:e.target.value})}/></label><label>Теги (через запятую)<input value={selected.tags.join(', ')} onChange={e=>edit({tags:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})}/></label><h2>Ингредиенты</h2>{selected.ingredients.map((ing,i)=><div className="ingredient" key={i}><input aria-label="Ингредиент" value={ing.name} onChange={e=>ingredient(i,{name:e.target.value})}/><input aria-label="Количество" value={ing.quantity??''} onChange={e=>ingredient(i,{quantity:e.target.value||null})}/><input aria-label="Единица" value={ing.unit??''} onChange={e=>ingredient(i,{unit:e.target.value||null})}/><button className="secondary" onClick={()=>edit({ingredients:selected.ingredients.filter((_,j)=>i!==j)})}>×</button></div>)}<button className="secondary" onClick={()=>edit({ingredients:[...selected.ingredients,{name:'',quantity:null,unit:null,note:null}]})}>+ Ингредиент</button><h2>Приготовление</h2><textarea rows={12} value={selected.instructions.join('\n')} onChange={e=>edit({instructions:e.target.value.split('\n')})}/><div className="actions"><button disabled={busy} onClick={save}>Сохранить</button><button className="secondary" onClick={()=>open(selected.id)}>Отменить изменения</button></div></>:<p>Выбери рецепт слева.</p>}<p role="status">{message}</p></section></div></main>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
