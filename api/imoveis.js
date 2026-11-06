import { google } from 'googleapis';
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1dWHX2-sZqZlSeDKercMS7NUiRHabmg7DqB1f_fttmeY';
const SAFE_KEYS = new Set(['ID','Bairro','Aluguel','Preço','Condomínio','IPTU','Quartos','Garagem','Varanda','Favorito','Status','Link','Latitude','Longitude']);
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Somente leitura. Edição autenticada ainda não habilitada.'});
  const email=process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key=process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g,'\n');
  if(!email||!key)return res.status(503).json({error:'Integração Google Sheets não configurada.'});
  try{
    const auth=new google.auth.JWT({email,key,scopes:['https://www.googleapis.com/auth/spreadsheets.readonly']});
    const sheets=google.sheets({version:'v4',auth});
    const {data}=await sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:"'Imóveis'!A1:AZ1000"});
    const [header,...rows]=data.values||[];
    if(!header)return res.status(200).json({imoveis:[]});
    const normalized=header.map(x=>String(x).trim());
    const imoveis=rows.filter(r=>r.some(Boolean)).map(row=>Object.fromEntries(normalized.flatMap((h,i)=>SAFE_KEYS.has(h)?[[h,row[i]??'']]:[])));
    return res.status(200).json({imoveis});
  }catch(e){console.error('Google Sheets read failed:',e.message);return res.status(502).json({error:'Falha ao consultar a planilha.'})}
}
