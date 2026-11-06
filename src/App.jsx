import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowUpRight, Bike, Building2, ChartNoAxesColumn, ChevronDown, ChevronRight,
  CircleCheck, CircleHelp, Clock3, Compass, ExternalLink, Heart, House, List,
  LocateFixed, MapPinned, PanelLeftClose, Search, ShieldCheck, SlidersHorizontal,
  Wallet, X
} from 'lucide-react';
import snapshot from './data.json';
import 'leaflet/dist/leaflet.css';
import './modern.css';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1dWHX2-sZqZlSeDKercMS7NUiRHabmg7DqB1f_fttmeY/edit';
const CORDEIRO_ADDRESS = 'Rua B, 915, Passaré, Fortaleza, Ceará, Brasil';
const fmt = n => Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'A confirmar';
const parseNumber = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const s = String(value).replace(/R\$\s?/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  return Number.isFinite(Number(s)) ? Number(s) : null;
};
const normalizedKey = key => key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const aliases = {
  id:'id', endereco:'endereco', bairro:'bairro', aluguel:'aluguel', aluguelr:'aluguel',
  preco:'aluguel', condominio:'condominio', iptu:'iptu', quartos:'quartos',
  garagem:'garagem', garagemmoto:'garagem', varanda:'varanda', favorito:'favorito',
  status:'status', link:'link', latitude:'latitude', longitude:'longitude',
  observacoes:'notas', notas:'notas', estacionamento:'estacionamento',
  estacionamentomensalr:'estacionamento', extras:'extras', taxasextrasr:'extras',
  caracteristicas:'caracteristicas', fonte:'fonte', contato:'contato'
};
function normalize(property) {
  const p = {};
  Object.entries(property).forEach(([key, value]) => {
    const mapped = aliases[normalizedKey(key)];
    if (mapped) p[mapped] = value;
  });
  ['aluguel', 'condominio', 'iptu', 'quartos', 'estacionamento', 'extras', 'latitude', 'longitude'].forEach(key => {
    p[key] = parseNumber(p[key]);
  });
  p.favorito = /^(true|sim|1)$/i.test(String(p.favorito));
  return p;
}
const total = p => p.aluguel === null ? null : p.aluguel + (p.condominio ?? 0) + (p.iptu ?? 0) + (p.estacionamento ?? 0) + (p.extras ?? 0);
const costsMissing = p => ['condominio', 'iptu', 'estacionamento', 'extras'].some(key => p[key] === null);
function motoStatus(p) {
  const g = String(p.garagem || '').toLowerCase();
  if (!g || /confirmar|não informad|nao informad|pendente/.test(g)) return 'unknown';
  if (/sem garagem|não tem vaga|nao tem vaga/.test(g) && !/sim|usuário|usuario/.test(g)) return 'no';
  if (/sim|vaga|coberta|moto|garagem/.test(g)) return 'yes';
  return 'unknown';
}
function statusTone(p) {
  const s = String(p.status || '').toLowerCase();
  if (/descart|indispon|acima do orçamento/.test(s)) return 'bad';
  if (/favorito|preferido/.test(s)) return 'good';
  return 'neutral';
}
const geoCache = new Map();
async function geocode(address) {
  if (geoCache.has(address)) return geoCache.get(address);
  const response = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=' + encodeURIComponent(address), { headers: {'Accept-Language':'pt-BR'} });
  if (!response.ok) return null;
  const hits = await response.json();
  const position = hits.length ? [Number(hits[0].lat), Number(hits[0].lon)] : null;
  geoCache.set(address, position);
  return position;
}
const pinIcon = (type, selected = false) => L.divIcon({
  className: 'custom-pin-wrapper',
  html: '<div class="pin-core ' + type + (selected ? ' pin-active' : '') + '"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' + (type === 'office' ? '<rect width="16" height="19" x="4" y="2" rx="2"/><path d="M9 21v-5h6v5M8 7h2m4 0h2M8 11h2m4 0h2"/>' : '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-7h6v7"/>') + '</svg></div>',
  iconSize:[44,53], iconAnchor:[22,49], tooltipAnchor:[0,-45]
});
const officeIcon = pinIcon('office');
const houseIcon = pinIcon('house');
const activeHouseIcon = pinIcon('house', true);
const haversine = (a,b) => {
  const rad=Math.PI/180, da=(b[0]-a[0])*rad, db=(b[1]-a[1])*rad;
  const v=Math.sin(da/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(db/2)**2;
  return 12742*Math.atan2(Math.sqrt(v),Math.sqrt(1-v));
};
function MapController({ visible, focus, coordinates }) {
  const map = useMap();
  useEffect(() => {
    if (!visible) return undefined;
    const handle = setTimeout(() => map.invalidateSize(), 160);
    return () => clearTimeout(handle);
  }, [map, visible]);
  useEffect(() => {
    if (visible && focus && coordinates[focus]) {
      map.flyTo(coordinates[focus], Math.max(map.getZoom(), 14), {duration:0.6});
    }
  }, [map, focus, visible, coordinates]);
  return null;
}
function Metric({ icon: Icon, value, label, accent }) {
  return <div className={'metric '+(accent || '')}><div className="metric-top"><span>{label}</span><Icon size={15}/></div><strong>{value}</strong></div>;
}
function PropertyCard({ p, selected, onOpen, onMap }) {
  const moto = motoStatus(p);
  return <article className={'property-card'+(selected?' is-selected':'')}>
    <button className="property-content" onClick={onOpen} aria-label={'Abrir detalhes de '+p.id}>
      <div className="card-top"><span className="prop-id">{p.id}</span><span className={'state '+statusTone(p)}>{p.status || 'A confirmar'}</span></div>
      <div className="card-heading"><div><div className="property-price">{fmt(total(p))}<small> /mês{costsMissing(p)?'*':''}</small></div><div className="property-neighborhood">{p.bairro || 'Bairro não informado'}</div></div><ChevronRight className="card-chevron" size={19}/></div>
      <p className="property-address">{p.endereco || 'Endereço não informado'}</p>
    </button>
    <div className="property-bottom">
      <div className="amenities">
        <span><House size={14}/>{p.quartos ?? '?'} quartos</span>
        <span className={moto==='yes'?'amenity-positive':moto==='no'?'amenity-negative':''}><Bike size={15}/>{moto==='yes'?'Vaga moto':moto==='no'?'Sem vaga':'Vaga a confirmar'}</span>
        {p.favorito && <span className="amenity-favorite"><Heart size={13} fill="currentColor"/> Favorito</span>}
      </div>
      <button className="map-shortcut" onClick={onMap} aria-label={'Localizar '+p.id+' no mapa'} title="Ver no mapa"><MapPinned size={17}/></button>
    </div>
  </article>;
}
function Detail({ property:p, onClose, onMap, showMap, coordsAvailable }) {
  return <aside className="detail-panel" role="dialog" aria-modal="true" aria-label={'Detalhes do imóvel '+p.id}>
    <div className="sheet-handle" aria-hidden="true"/>
    <div className="detail-header"><div><span className="detail-eyebrow">FICHA DO IMÓVEL · {p.id}</span><h2>{p.bairro || 'Bairro não informado'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar detalhes"><X size={19}/></button></div>
    <div className="detail-content">
      <p className="detail-address"><MapPinned size={15}/>{p.endereco || 'Endereço não informado'}</p>
      <div className="photo-placeholder"><House size={28}/><strong>Fotos ainda não disponíveis</strong><span>Sem inventar imagens do imóvel.</span></div>
      <div className="detail-price"><span>VALOR MENSAL CONHECIDO</span><strong>{fmt(total(p))}</strong>{costsMissing(p)?<small>* Podem existir taxas adicionais não informadas.</small>:null}</div>
      <div className="detail-grid">
        {[
          ['Aluguel',fmt(p.aluguel)],['Condomínio',fmt(p.condominio)],
          ['IPTU',fmt(p.iptu)],['Quartos',p.quartos??'A confirmar'],
          ['Garagem moto',p.garagem||'A confirmar'],['Varanda',p.varanda||'A confirmar']
        ].map(([title,value])=><div key={title}><span>{title}</span><strong>{value}</strong></div>)}
      </div>
      <div className="detail-section"><strong>Situação</strong><div className={'state '+statusTone(p)}>{p.status||'A confirmar'}</div></div>
      {p.caracteristicas && <div className="detail-section"><strong>Características</strong><p>{p.caracteristicas}</p></div>}
      <div className="detail-section"><strong>Observações</strong><p>{p.notas||'Nenhuma observação cadastrada.'}</p></div>
      <div className="detail-actions">
        {p.link && <a className="primary-action" href={p.link} target="_blank" rel="noopener noreferrer">Abrir anúncio <ExternalLink size={16}/></a>}
        <button className="secondary-action" onClick={onMap} disabled={!coordsAvailable}><MapPinned size={16}/>{showMap?'Centralizar no mapa':'Ver no mapa'}</button>
      </div>
      <div className="detail-disclaimer"><CircleHelp size={14}/> Confirme valores e disponibilidade diretamente com o anunciante.</div>
    </div>
  </aside>;
}
export default function App() {
  const [properties,setProperties]=useState(()=>snapshot.map(normalize));
  const [source,setSource]=useState('Prévia da planilha');
  const [search,setSearch]=useState('');
  const [bairro,setBairro]=useState('');
  const [sort,setSort]=useState('favorites');
  const [favorites,setFavorites]=useState(false);
  const [withinBudget,setWithinBudget]=useState(false);
  const [hasMoto,setHasMoto]=useState(false);
  const [selected,setSelected]=useState(null);
  const [mobileView,setMobileView]=useState('list');
  const [desktopChart,setDesktopChart]=useState(false);
  const [positions,setPositions]=useState({});
  const [work,setWork]=useState(null);
  const [focused,setFocused]=useState(null);

  useEffect(()=>{
    let alive=true;
    fetch('/api/imoveis',{cache:'no-store'})
      .then(r=>{if(!r.ok)throw Error('Integração indisponível');return r.json()})
      .then(json=>{if(alive&&Array.isArray(json.imoveis)){setProperties(json.imoveis.map(normalize).filter(p=>p.id));setSource('Planilha conectada')}})
      .catch(()=>{});
    return()=>{alive=false};
  },[]);
  useEffect(()=>{
    let alive=true;
    async function run(){
      try{const point=await geocode(CORDEIRO_ADDRESS);if(alive&&point)setWork(point)}catch{}
      for(const property of properties){
        if(!alive)break;
        if(property.latitude!==null && property.longitude!==null){
          setPositions(prev=>({...prev,[property.id]:[property.latitude,property.longitude]}));
          continue;
        }
        if(!property.endereco || /não informado|não confirmado/i.test(property.endereco)) continue;
        try{
          const query=/fortaleza/i.test(property.endereco)?property.endereco:property.endereco+', Fortaleza, CE';
          const point=await geocode(query);
          if(alive&&point)setPositions(prev=>({...prev,[property.id]:point}));
        }catch{}
        await new Promise(resolve=>setTimeout(resolve,1150));
      }
    }
    run();
    return()=>{alive=false};
  },[properties]);
  useEffect(()=>{
    const onKey=event=>{if(event.key==='Escape')setSelected(null)};
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[]);
  const neighborhoods=useMemo(()=>[...new Set(properties.map(p=>p.bairro).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[properties]);
  const filtered=useMemo(()=>{
    const terms=search.trim().toLocaleLowerCase('pt-BR');
    const items=properties.filter(p=>
      (!terms||[p.id,p.bairro,p.endereco].join(' ').toLocaleLowerCase('pt-BR').includes(terms)) &&
      (!bairro||p.bairro===bairro) && (!favorites||p.favorito) &&
      (!withinBudget||(total(p)!==null&&total(p)<=1000)) &&
      (!hasMoto||motoStatus(p)==='yes')
    );
    return items.sort(sort==='price'?(a,b)=>(total(a)??Infinity)-(total(b)??Infinity):sort==='name'?(a,b)=>(a.bairro||'').localeCompare(b.bairro||'','pt-BR'):(a,b)=>Number(b.favorito)-Number(a.favorito));
  },[properties,search,bairro,favorites,withinBudget,hasMoto,sort]);
  const chart=useMemo(()=>Object.entries(filtered.reduce((acc,p)=>{const b=p.bairro||'Não informado';acc[b]=(acc[b]||0)+1;return acc},{})).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value),[filtered]);
  const active=properties.find(p=>p.id===selected);
  const showMap=mobileView==='map';
  function focusMap(p){
    setFocused(p.id);
    setMobileView('map');
    setDesktopChart(false);
  }
  function clearFilters(){
    setSearch('');setBairro('');setFavorites(false);setWithinBudget(false);setHasMoto(false);
  }
  const filterCount=Number(Boolean(bairro))+Number(favorites)+Number(withinBudget)+Number(hasMoto);
  const showCharts=mobileView==='analysis'||desktopChart;
  return <div className={'app-shell mobile-'+mobileView}>
    <section className={'side-panel'+(mobileView==='map'?' mobile-hide':'')}>
      <header className="dashboard-header">
        <div className="brand-row">
          <div className="brand"><span className="brand-mark"><House size={20} strokeWidth={2.4}/></span><div><strong>Meu Ap<span className="brand-period">.</span></strong><small>CENTRAL DE IMÓVEIS</small></div></div>
          <span className={'connection-status'+(source==='Planilha conectada'?' online':'')}><span/>{source}</span>
        </div>
        <div className="intro-row"><span>Seu próximo lar, sem complicação.</span><a href={SHEET_URL} target="_blank" rel="noopener noreferrer" title="Abrir planilha mestre">Planilha <ArrowUpRight size={13}/></a></div>
        <div className="metric-grid"><Metric icon={House} value={properties.length} label="Cadastrados"/><Metric icon={Heart} value={properties.filter(p=>p.favorito).length} label="Favoritos" accent="rose"/><Metric icon={Wallet} value={properties.filter(p=>total(p)!==null&&total(p)<=1000).length} label="Até R$ 1 mil*" accent="mint"/></div>
      </header>
      <div className="toolbar">
        <div className="search-input"><Search size={17}/><input aria-label="Buscar imóveis" placeholder="Buscar bairro, endereço ou ID..." value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button onClick={()=>setSearch('')} aria-label="Limpar busca"><X size={15}/></button>}</div>
        <div className="select-row"><div className="select-box"><MapPinned size={15}/><select aria-label="Selecionar bairro" value={bairro} onChange={e=>setBairro(e.target.value)}><option value="">Todos os bairros</option>{neighborhoods.map(b=><option key={b} value={b}>{b}</option>)}</select><ChevronDown size={13}/></div><div className="select-box sort-box"><SlidersHorizontal size={15}/><select aria-label="Ordenar imóveis" value={sort} onChange={e=>setSort(e.target.value)}><option value="favorites">Destaques</option><option value="price">Menor custo</option><option value="name">Por bairro</option></select><ChevronDown size={13}/></div></div>
        <div className="chip-row"><button className={'filter-chip'+(withinBudget?' active':'')} onClick={()=>setWithinBudget(v=>!v)} aria-pressed={withinBudget}><Wallet size={14}/> Até R$ 1 mil</button><button className={'filter-chip'+(hasMoto?' active':'')} onClick={()=>setHasMoto(v=>!v)} aria-pressed={hasMoto}><Bike size={15}/> Vaga moto</button><button className={'filter-chip'+(favorites?' active':'')} onClick={()=>setFavorites(v=>!v)} aria-pressed={favorites}><Heart size={14}/> Favoritos</button></div>
      </div>
      <div className="results-heading"><div><strong>{showCharts?'Visão geral':'Imóveis encontrados'}</strong><span>{filtered.length} resultado{filtered.length===1?'':'s'}</span></div><div className="heading-actions">{filterCount>0&&<button onClick={clearFilters} className="clear-button">Limpar filtros</button>}<button className="desktop-view-toggle" onClick={()=>setDesktopChart(v=>!v)} aria-label={desktopChart?'Ver lista':'Ver gráfico'} title={desktopChart?'Ver lista':'Ver gráfico'}>{desktopChart?<List size={18}/>:<ChartNoAxesColumn size={18}/>}</button></div></div>
      {showCharts?<div className="analytics-body"><div className="analytics-card"><div className="analytics-title"><strong>Imóveis por bairro</strong><span>Distribuição dos resultados</span></div>{chart.length?<ResponsiveContainer width="100%" height={Math.max(230,chart.length*43)}><BarChart data={chart} layout="vertical" margin={{left:0,right:18,top:8,bottom:8}}><CartesianGrid stroke="#eef1f7" strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false} tick={{fill:'#8692aa',fontSize:11}} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="name" width={95} tick={{fill:'#52617b',fontSize:10}} axisLine={false} tickLine={false}/><ChartTooltip contentStyle={{border:'1px solid #e8edf5',borderRadius:12,fontSize:12}}/><Bar dataKey="value" fill="#4669ed" radius={[0,6,6,0]} name="Imóveis"/></BarChart></ResponsiveContainer>:<p className="empty-results">Sem dados com os filtros atuais.</p>}</div><p className="chart-note"><CircleHelp size={15}/>Os valores são contagens dos imóveis cadastrados, não estimativas do mercado.</p></div>:<div className="properties-scroll">{filtered.length?filtered.map(p=><PropertyCard key={p.id} p={p} selected={selected===p.id} onOpen={()=>setSelected(p.id)} onMap={()=>focusMap(p)}/>):<div className="empty-results"><Search size={27}/><strong>Nenhum imóvel encontrado</strong><span>Tente ajustar os filtros.</span><button onClick={clearFilters}>Limpar filtros</button></div>}</div>}
      <footer className="side-footer"><CircleHelp size={14}/> *Total com parcelas conhecidas. Taxas não informadas podem aumentar o valor.</footer>
    </section>
    <section className={'map-section'+(showMap?' mobile-show':'')} aria-label="Mapa dos imóveis">
      <MapContainer className="leaflet-map" center={[-3.78,-38.58]} zoom={12} zoomControl={false}>
        <MapController visible={showMap||window.innerWidth>760} focus={focused} coordinates={positions}/>
        <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}/>
        {work&&<Marker position={work} icon={officeIcon}><Tooltip direction="top" className="property-tooltip" opacity={1}><div className="map-tooltip"><strong>🏢 Cordeiro · trabalho</strong><span>Referência aproximada · confirmar endereço</span></div></Tooltip></Marker>}
        {filtered.map(p=>positions[p.id]&&<Marker key={p.id} position={positions[p.id]} icon={p.id===selected?activeHouseIcon:houseIcon} eventHandlers={{click:()=>setSelected(p.id)}}>
          <Tooltip direction="top" className="property-tooltip" opacity={1}><div className="map-tooltip"><strong>📍 {p.endereco || 'Endereço não confirmado'}</strong><span>💰 {fmt(p.aluguel)} + {fmt(p.condominio)} = <b>{p.aluguel!==null&&p.condominio!==null?fmt(p.aluguel+p.condominio):'A confirmar'}</b></span><span>🏢 {work?haversine(positions[p.id],work).toLocaleString('pt-BR',{maximumFractionDigits:1})+' km em linha reta':'Distância a calcular'} da Cordeiro</span></div></Tooltip>
        </Marker>)}
      </MapContainer>
      <div className="map-overlay-top"><div className="map-overlay-icon"><Compass size={19}/></div><div><strong>Explore no mapa</strong><span>{filtered.length} imóveis na seleção · Fortaleza/CE</span></div></div>
      <div className="map-key"><span><i className="key-dot blue"/> Imóveis</span><span><i className="key-dot green"/> Cordeiro</span><small>Posições aproximadas</small></div>
    </section>
    <nav className="mobile-nav" aria-label="Navegação do painel">
      <button className={mobileView==='list'?'current':''} onClick={()=>setMobileView('list')} aria-current={mobileView==='list'?'page':undefined}><List size={19}/><span>Imóveis</span></button>
      <button className={mobileView==='map'?'current':''} onClick={()=>setMobileView('map')} aria-current={mobileView==='map'?'page':undefined}><MapPinned size={19}/><span>Mapa</span></button>
      <button className={mobileView==='analysis'?'current':''} onClick={()=>setMobileView('analysis')} aria-current={mobileView==='analysis'?'page':undefined}><ChartNoAxesColumn size={19}/><span>Análise</span></button>
    </nav>
    {active&&<><div className="detail-backdrop" onClick={()=>setSelected(null)}/><Detail property={active} onClose={()=>setSelected(null)} onMap={()=>focusMap(active)} showMap={showMap} coordsAvailable={Boolean(positions[active.id])}/></>}
  </div>;
}
