'use strict';
const DB_KEY = 'dilekce_db_v1';
const TERMS = [
  { re: /aracılığla/gi, fix: 'aracılığıyla', msg: '"aracılığla" yazımı yanlış, doğrusu "aracılığıyla"', lvl: 'c' },
  { re: /konuğu/i, fix: 'konusu', msg: 'Yanlış: "konuğu" → doğrusu "konusu"', lvl: 'c' },
  { re: /müvekil\s*im/i, fix: 'müvekkilim', msg: 'Doğru yazım "müvekkil"dir (çift k)', lvl: 'c' },
  { re: /müvekkli/i, fix: 'müvekkili', msg: 'Doğru yazım "müvekkili"dir', lvl: 'c' },
  { re: /hakim\b/gi, fix: 'hâkim', msg: "TDK'ya göre \"hâkim\" şapka ile yazılır", lvl: 'w' },
  { re: /dava\s*dilekçe/i, fix: 'dava dilekçesi', msg: 'Doğrusu "dava dilekçesi"dir', lvl: 'c' },
  { re: /tşk/i, fix: 'Talebin', msg: 'Kısaltma kullanmayın: "Talebin" yazın', lvl: 'w' },
  { re: /icra\s*dairesi/i, fix: 'İcra Dairesi', msg: 'Kurum adı büyük harfle: "İcra Dairesi"', lvl: 'w' },
  { re: /nöbetçi\s*asliye/i, fix: 'Nöbetçi Asliye', msg: 'Büyük harfle başlayın: "Nöbetçi Asliye"', lvl: 'w' },
  { re: /davalı\s*vekil/i, fix: 'davalı vekili', msg: 'El yazısı kısaltmalarından kaçının', lvl: 'w' },
  { re: /madde\s*(\d{1,3})/gi, fix: 'madde $1', msg: 'Madde ifadesi küçük harf ve numara ile: "madde 4"', lvl: 'w' },
  { re: /şıkkı\b/gi, fix: 'bendine', msg: 'Yasal atıflarda "şıkkı" yerine "bendi" tercih edilir', lvl: 'w' },
  { re: /tarafın\s*ca/i, fix: 'tarafça', msg: 'Yaygın hata: "tarafınca" → doğrusu "tarafça"', lvl: 'c' },
  { re: /talebe\s*rağmen/i, fix: 'talebe rağmen', msg: 'Cümleyi gözden geçirin', lvl: 'w' },
  { re: /aşağıda\s*izah/i, fix: 'aşağıda izah', msg: 'Doğrusu "aşağıda izah edildiği üzere"', lvl: 'w' },
];
const load = () => { try { const d = JSON.parse(localStorage.getItem(DB_KEY)); if (d && typeof d === 'object') return d; } catch(e){} return { saved: [] }; };
let storage = load();
const saveStore = () => localStorage.setItem(DB_KEY, JSON.stringify(storage));

/* ---------------- Templates ---------------- */
const TEMPLATES = {
  dava: {
    name: 'Dava Dilekçesi',
    desc: 'Alacak, tazminat, tapu iptali gibi hukuk davalarının açılması',
    fields: [
      {k:'court', l:'Mahkeme adı', ph:'T.C. ... Asliye Hukuk Mahkemesi', req:true},
      {k:'pla', l:'Davacı adı soyadı / unvanı', ph:'AD SOYAD', req:true},
      {k:'plaTc', l:'Davacı T.C. (ops.)', ph:'12345678901'},
      {k:'plAdv', l:'Davacı vekili (avukat)', ph:'Av. AD SOYAD'},
      {k:'def', l:'Davalı adı soyadı / unvanı', ph:'AD SOYAD', req:true},
      {k:'defTc', l:'Davalı T.C. (ops.)', ph:'12345678901'},
      {k:'caseNo', l:'Dosya no (ops.)', ph:''},
      {k:'subject', l:'Dava konusu değer', ph:'Alacak ve faizi', req:true},
      {k:'amount', l:'Talep edilen tutar (ops.)', ph:'100.000,00 TL'},
      {k:'facts', l:'Olaylar', type:'textarea', ph:'Olayları tarihlerle, sırasıyla anlatın', req:true},
      {k:'legal', l:'Hukuki sebepler', type:'textarea', ph:'Örn: TBK m.49, m.50 (tazminat); TBK m.112 vd. (alacak)'},
    ],
    render:f=>`T.C. ${f.court}
DAVACI : ${f.pla}${f.plaTc?'\nT.C. KİMLİK NO : '+f.plaTc:''}
VEKİLİ : ${f.plAdv||'Av. (vekil adı)'}${f.caseNo?('\nDOSYA NO : '+f.caseNo):''}
DAVALI : ${f.def}${f.defTc?'\nT.C. KİMLİK NO : '+f.defTc:''}
KONU : ${f.subject}

AÇIKLAMALAR :

1. ${f.facts}

HUKUKİ SEBEPLER :

${f.legal||'İlgili yasal düzenlemeler.'}

SONUÇ VE İSTEM :

Yukarıda arz ve izah edilen nedenlerle; fazlaya ilişkin haklarımız saklı kalmak kaydıyla${f.amount?(' '+f.amount+' tutarın dava tarihinden itibaren işleyecek yasal faizi ile birlikte davalıdan tahsiline,'):''} davanın kabulüne, yargılama giderleri ve vekalet ücretinin karşı tarafa yükletilmesine karar verilmesini saygıyla talep ederiz. ${new Date().getFullYear()}

Davacı Vekili
${f.plAdv||'Av. ________'}`,
  },
  cevap: {
    name: 'Cevap Dilekçesi',
    desc: 'Açılan davaya karşı cevap / savunma',
    fields: [
      {k:'court', l:'Mahkeme adı', ph:'T.C. ... Asliye Hukuk Mahkemesi', req:true},
      {k:'caseNo', l:'Esas no', ph:'2024/123 E.', req:true},
      {k:'def', l:'Davalı (siz)', ph:'AD SOYAD', req:true},
      {k:'defAdv', l:'Davalı vekili', ph:'Av. AD SOYAD'},
      {k:'pla', l:'Davacı', ph:'AD SOYAD'},
      {k:'subject', l:'Dava konusu', ph:'Alacak davası'},
      {k:'answer', l:'Cevap ve savunma', type:'textarea', ph:'Davaya karşı savunmanızı, red nedenlerini yazın', req:true},
      {k:'counter', l:'Karşı talep / takas-mahsup (ops.)', type:'textarea', ph:'Varsa rücu, takas-mahsup talebiniz'},
    ],
    render:f=>`T.C. ${f.court}
ESAS NO : ${f.caseNo}

DAVALI : ${f.def}
VEKİLİ : ${f.defAdv||'Av. ________'}
DAVACI : ${f.pla||'________'}
KONU : ${f.subject} davasına karşı cevap

AÇIKLAMALAR :

1. ${f.answer}
${f.counter?'\n2. Karşı talebimiz; aşağıdaki gibidir:\n\n'+f.counter:''}
HUKUKİ SEBEPLER :

${f.subject&&'İlgili yasal düzenlemeler ve yargısal içtihatlar.'}

SONUÇ VE İSTEM :

Yukarıda arz ve izah edilen nedenlerle; davanın ${f.subject ? 'reddine' : 'reddine'}, yargılama giderleri ve vekalet ücretinin karşı tarafa yükletilmesine karar verilmesini saygıyla talep ederiz. ${new Date().getFullYear()}

Davalı Vekili
${f.defAdv||'Av. ________'}`,
  },
  itiraz: {
    name: 'İcra Takibine İtiraz',
    desc: 'İcra takibine itiraz dilekçesi',
    fields: [
      {k:'mudurluk', l:'İcra Dairesi', ph:'... İcra Müdürlüğü', req:true},
      {k:'caseNo', l:'Takip no', ph:'2024/123 E.', req:true},
      {k:'borclu', l:'Borçlu (siz)', ph:'AD SOYAD', req:true},
      {k:'vekil', l:'Borçlu vekili', ph:'Av. AD SOYAD'},
      {k:'alacakli', l:'Alacaklı', ph:'AD SOYAD'},
      {k:'amount', l:'Takip konusu tutar', ph:'100.000,00 TL'},
      {k:'reason', l:'İtiraz gerekçesi', type:'textarea', ph:'Borca ve/veya yetkiye itiraz nedeniniz', req:true},
    ],
    render:f=>`T.C. ${f.mudurluk}
TAKİP NO : ${f.caseNo}

BORÇLU : ${f.borclu}
VEKİLİ : ${f.vekil||'Av. ________'}
ALACAKLI : ${f.alacakli||'________'}
KONU : İcra takibine itiraz edilmesi

AÇIKLAMALAR :

1. Müvekkil aleyhine yapılan ${f.mudurluk} ${f.caseNo} sayılı takipte; ${f.amount||'iş bu takip konusu borç'} yönünden borca (ve gerekçe varsa yetkiye) itirazımız bulunmaktadır.

2. ${f.reason}

HUKUKİ SEBEPLER :

İİK m.62 ve ilgili mevzuat.

SONUÇ VE İSTEM :

Yukarıda arz ve izah edilen nedenlerle; itirazımızın kabulü ile takibin durdurulmasına, haksız ve kötü niyetli takip yapıldığının tespiti halinde alacaklının icra inkar tazminatına mahkum edilmesine karar verilmesini saygıyla talep ederiz. ${new Date().getFullYear()}

Borçlu Vekili
${f.vekil||'Av. ________'}`,
  },
  itirazin_iptali: {
    name: 'İtirazın İptali Davası',
    desc: 'İcra takibine yapılan itirazın iptali için dava',
    fields: [
      {k:'court', l:'Mahkeme adı', ph:'T.C. ... Asliye Hukuk Mahkemesi', req:true},
      {k:'icra_d', l:'İcra Dairesi', ph:'... İcra Müdürlüğü', req:true},
      {k:'takipNo', l:'Takip no', ph:'2024/123 E.', req:true},
      {k:'davaci', l:'Davacı (alacaklı)', ph:'AD SOYAD', req:true},
      {k:'vekil', l:'Davacı vekili', ph:'Av. AD SOYAD'},
      {k:'davali', l:'Davalı (borçlu)', ph:'AD SOYAD'},
      {k:'amount', l:'Alacak tutarı', ph:'100.000,00 TL', req:true},
      {k:'facts', l:'Olaylar / alacağın dayanağı', type:'textarea', ph:'Alacağın neden doğduğunu anlatın', req:true},
    ],
    render:f=>`T.C. ${f.court}
ESAS : Her ne kadar ${f.icra_d} ${f.takipNo} sayılı takip ile başlatılmışsa da; anılan takibe yapılan itirazın iptali ve takibin devamına karar verilmesi talebi.

DAVACI : ${f.davaci}
VEKİLİ : ${f.vekil||'Av. ________'}
DAVALI : ${f.davali}

AÇIKLAMALAR :

1. Müvekkil ile davalı arasında doğan alacak nedeniyle, davalı aleyhine ${f.icra_d} ${f.takipNo} sayılı takip başlatılmıştır.

2. ${f.facts}

3. Davalı, haksız ve hukuki dayanaktan yoksun olarak borca itiraz etmiş; itiraz üzerine takip durmuştur.

HUKUKİ SEBEPLER :

İİK m.67 vd.

SONUÇ VE İSTEM :

Yukarıda arz ve izah edilen nedenlerle; itirazın iptaline, ${f.amount||'takip konusu alacağın'} takibin devamına ve %20'den az olmamak üzere icra inkar tazminatının davalıdan tahsiline, yargılama giderleri ve vekalet ücretinin davalıya yükletilmesine karar verilmesini saygıyla talep ederiz. ${new Date().getFullYear()}

Davacı Vekili
${f.vekil||'Av. ________'}`,
  },
  istinaf: {
    name: 'İstinaf Başvurusu',
    desc: 'İlk derece mahkemesi kararına karşı istinaf',
    fields: [
      {k:'ilkcourt', l:'İlk derece mahkemesi', ph:'T.C. ... Asliye Hukuk Mahkemesi', req:true},
      {k:'esasNo', l:'Esas no', ph:'2024/123 E.', req:true},
      {k:'kararNo', l:'Karar no', ph:'2025/456 K.', req:true},
      {k:'bolge', l:'Bölge adliye mahkemesi', ph:'İstanbul Bölge Adliye Mahkemesi', req:true},
      {k:'taraf', l:'Başvuran (taraf)', ph:'AD SOYAD', req:true},
      {k:'vekil', l:'Başvuran vekili', ph:'Av. AD SOYAD'},
      {k:'karsi', l:'Karşı taraf', ph:'AD SOYAD'},
      {k:'gerekce', l:'İstinaf gerekçeleri', type:'textarea', ph:'Hangi yönlerden bozulması gerektiğini yazın', req:true},
    ],
    render:f=>`T.C. ${f.ilkcourt}
ESAS NO : ${f.esasNo}
KARAR NO : ${f.kararNo}

${f.taraf} VEKİLİ : ${f.vekil||'Av. ________'}
KARŞI TARAF : ${f.karsi||'________'}

${f.bolge}
İLGİLİ HUKUK DAİRESİ BAŞKANLIĞI'NA

KONU : ${f.esasNo} esas, ${f.kararNo} karar sayılı ilamın istinaf incelenmesi talebi.

AÇIKLAMALAR :

1. ${f.ilkcourt} ${f.esasNo} esas, ${f.kararNo} karar sayılı karar, ${new Date().toLocaleDateString('tr-TR')} tarihinde vekiline tebliğ edilmiştir.

2. ${f.gerekce}

3. Anılan karar, kanuna, usule ve maddi vakıalara aykırı olup; müvekkil aleyhine karar sonucunu etkileyecek eksik inceleme ve hatalı değerlendirmelere dayanmaktadır.

HUKUKİ SEBEPLER :

HMK m.341 vd., HMK m.353 vd.

SONUÇ VE İSTEM :

Yukarıda arz ve izah edilen nedenlerle; ${f.kararNo} karar sayılı kararın kaldırılmasına / bozulmasına; yargılama giderleri ve vekalet ücretinin karşı tarafa yükletilmesine karar verilmesini saygıyla talep ederiz. ${new Date().getFullYear()}

${f.taraf} Vekili
${f.vekil||'Av. ________'}`,
  },
  suclama: {
    name: 'Suç Duyurusu / Şikayet',
    desc: 'Cumhuriyet Başsavcılığına suç duyurusu (şikayet)',
    fields: [
      {k:'bsavcilik', l:'Cumhuriyet Başsavcılığı', ph:'... Cumhuriyet Başsavcılığı', req:true},
      {k:'sikayetci', l:'Şikayetçi', ph:'AD SOYAD', req:true},
      {k:'vekil', l:'Şikayetçi vekili', ph:'Av. AD SOYAD'},
      {k:'supheli', l:'Şüpheli', ph:'AD SOYAD', req:true},
      {k:'suclama', l:'Şikayet konusu olay', type:'textarea', ph:'Suça konu olayı, tarih ve yerle birlikte anlatın', req:true},
      {k:'suclar', l:'Tespit edilen suçlar',  ph:'Dolandırıcılık (TCK m.157), tehdit (TCK m.106) gibi'},
    ],
    render:f=>`T.C. ${f.bsavcilik}

ŞİKAYETÇİ : ${f.sikayetci}
VEKİLİ : ${f.vekil||'Av. ________'}
ŞÜPHELİ : ${f.supheli||'________'}
KONU : Suç duyurusu / şikayet.${f.suclar?(' Suçlar: '+f.suclar+'.'):''}

AÇIKLAMALAR :

1. ${f.suclama}

2. Şüpheli hakkında kamu davası açılması için gereken tüm koşullar oluşmuştur.

HUKUKİ SEBEPLER :

TCK'nun ilgili maddeleri, CMK m.158 vd.

SONUÇ VE İSTEM :

Yukarıda arz ve izah edilen nedenlerle; şüpheli hakkında ${f.suclar||'anılan suçlardan'} kamu davası açılmasına karar verilmesini saygıyla talep ederiz. ${new Date().getFullYear()}

Şikayetçi Vekili
${f.vekil||'Av. ________'}`,
  },
  genel: {
    name: 'Genel Başvuru / Talep',
    desc: 'Kurumlara genel dilekçe / bilgi talebi',
    fields: [
      {k:'kurum', l:'Muhatap kurum', ph:'T.C. ... Valiliği', req:true},
      {k:'basvuran', l:'Başvuran', ph:'AD SOYAD', req:true},
      {k:'tc', l:'T.C. kimlik no (ops.)', ph:''},
      {k:'konu', l:'Konu', ph:'Kısa başlık', req:true},
      {k:'metin', l:'Talebiniz', type:'textarea', ph:'Talebinizi açıkça yazın', req:true},
    ],
    render:f=>`T.C. ${f.kurum}

BAŞVURAN : ${f.basvuran}${f.tc?'\nT.C. KİMLİK NO : '+f.tc:''}
KONU : ${f.konu}

AÇIKLAMALAR :

1. ${f.metin}

SONUÇ VE İSTEM :

Yukarıda arz ve izah edilen nedenlerle; talebimizin değerlendirilerek gereğinin yapılmasını saygıyla talep ederim. ${new Date().getFullYear()}

Başvuran
${f.basvuran}`,
  },
};

/* ---------------- Terminoloji check ---------------- */
function checkText(text){
  const out = [];
  if (!text || !text.trim()) return out;
  for (const t of TERMS){
    t.re.lastIndex = 0;
    if (t.re.test(text)){ out.push({ ...t, re: new RegExp(t.re.source, t.re.flags) }); }
  }
  const miss = (text.match(/(<|>|XXXX|____|\.\.\.\.|yazın|doldurun)/gi) || []).length;
  if (miss) out.push({ msg: 'Metinde boş / yer tutucu ifadeler bulunuyor. Lütfen tamamlayın.', lvl: 'c', fix: '' });
  const tl = (text.match(/lorem|aaa|test|örnek/i) || []).length;
  if (tl) out.push({ msg: 'Metinde deneme / örnek ifadeler var, kaldırın.', lvl: 'w', fix: '' });
  return out;
}

/* ---------------- UI ---------------- */
let currentType = 'dava';
let edits = null;

const $tabs = document.querySelector('.tabs');
const $fields = document.getElementById('fields');
const $preview = document.getElementById('preview');
const $checks = document.getElementById('checks');
const $typeSel = document.getElementById('typeSel');

function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function valOf(f){ return (edits[f.k]||''); }

function buildForm(){
  const t = TEMPLATES[currentType];
  $typeSel.selectedIndex = Object.keys(TEMPLATES).indexOf(currentType);
  $fields.innerHTML = t.fields.map(f=>{
    const v = esc(valOf(f));
    const inp = f.type==='textarea'
      ? `<textarea data-k="${f.k}" rows="${f.rows||4}" placeholder="${esc(f.ph||'')}">${v}</textarea>`
      : `<input data-k="${f.k}" type="text" value="${v}" placeholder="${esc(f.ph||'')}">`;
    return `<label>${esc(f.l)}${f.req?' <span style="color:var(--crit)">*</span>':''}${inp}</label>`;
  }).join('');
  $fields.querySelectorAll('input,textarea').forEach(el=>{
    const k = el.dataset.k;
    el.addEventListener('input', ()=>{ edits[k]=el.value; renderPreview(); });
  });
}

function applyChecks(txt){
  const checks = checkText(txt);
  const checkEls = checks.map(c=>`<li class="${c.lvl==='c'?'c':'w'}">${esc(c.msg)}</li>`).join('');
  if (checks.some(c=>c.lvl==='c')){
    $checks.className = 'check-box crit';
    $checks.innerHTML = `<div class="t">Kritik uyarılar (${checks.filter(c=>c.lvl==='c').length})</div><ul>${checkEls}</ul>`;
  } else if (checks.length){
    $checks.className = 'check-box warn';
    $checks.innerHTML = `<div class="t">Öneriler (${checks.length})</div><ul>${checkEls}</ul>`;
  } else {
    $checks.className = 'check-box ok';
    $checks.innerHTML = `<div class="t">✓ Terminoloji kontrolü geçti</div><ul><li class="o">Dikkate değer hata bulunamadı.</li></ul>`;
  }
}

function renderPreview(){
  const t = TEMPLATES[currentType];
  const txt = t.render(edits||{});
  $preview.value = txt;
  applyChecks(txt);
}

function newDilekce(type){
  currentType = type || 'dava';
  edits = {};
  TEMPLATES[currentType].fields.forEach(f=> edits[f.k]='');
  buildForm();
  renderPreview();
}
function saveCurrent(){
  const txt = $preview.value.trim();
  if (!txt) return toast('Uyarı','Dilekçe içeriği boş','warn');
  const t = TEMPLATES[currentType];
  const name = prompt('Kayıt adı:', t.name + ' - ' + (edits.pla||edits.sikayetci||edits.basvuran||new Date().toLocaleDateString('tr-TR')));
  if (!name) return;
  const rec = { id: Date.now().toString(36)+Math.random().toString(36).slice(2,7), type: currentType, typeName: t.name, name, text: txt, at: Date.now() };
  storage.saved.unshift(rec);
  saveStore();
  renderSaved();
  toast('Kaydedildi', name, 'ok');
  showTab('saved');
}
function renderSaved(filter){
  const q = (document.getElementById('savedSearch').value||'').toLowerCase().trim();
  const list = document.getElementById('savedList');
  const arr = storage.saved.filter(r=> q ? (r.name+r.text).toLowerCase().includes(q) : true);
  if (!arr.length){ list.innerHTML = '<div class="empty">Henüz kayıtlı dilekçe yok.</div>'; return; }
  list.innerHTML = arr.map(r=>`<div class="ditem">
    <div class="dt">${new Date(r.at).toLocaleString('tr-TR')} · ${esc(r.typeName)}</div>
    <h4>${esc(r.name)}</h4>
    <p>${esc(r.text.slice(0,220))}${r.text.length>220?'…':''}</p>
    <div class="acts">
      <button class="btn sm" data-open="${r.id}">Aç / Düzenle</button>
      <button class="btn sm" data-copy="${r.id}">Kopyala</button>
      <button class="btn sm ghost" data-del="${r.id}">Sil</button>
    </div>
  </div>`).join('');
}
function switchLoad(id){
  const r = storage.saved.find(x=>x.id===id);
  if (!r) return;
  currentType = r.type;
  newDilekce(r.type);
  $preview.value = r.text;
  applyChecks(r.text);
  showTab('new');
}
function showTab(name){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
  document.getElementById('pane-new').classList.toggle('hidden', name!=='new');
  document.getElementById('pane-saved').classList.toggle('hidden', name!=='saved');
}

/* ---------------- Actions ---------------- */
function copyPreview(){
  const t = $preview.value.trim();
  if (!t) return toast('Uyarı','Dilekçe içeriği boş','warn');
  navigator.clipboard.writeText(t).then(()=>toast('Kopyalandı','Panoya kopyalandı','ok')).catch(()=>{
    $preview.select(); document.execCommand('copy'); toast('Kopyalandı','Panoya kopyalandı','ok');
  });
}
function downloadPreview(){
  const t = $preview.value.trim();
  if (!t) return toast('Uyarı','Dilekçe içeriği boş','warn');
  const a = document.createElement('a');
  const name = (TEMPLATES[currentType].name + '-' + new Date().toISOString().slice(0,10)) + '.txt';
  a.href = URL.createObjectURL(new Blob([t], {type:'text/plain;charset=utf-8'}));
  a.download = name; a.click();
  toast('İndirildi', name, 'ok');
}
function printPreview(){
  const t = $preview.value.trim();
  if (!t) return toast('Uyarı','Dilekçe içeriği boş','warn');
  const area = document.getElementById('printArea');
  area.textContent = t;
  window.print();
}

/* ---------------- Toast ---------------- */
function toast(t,b,cls){
  const el = document.createElement('div');
  el.className = 'toast ' + (cls||'');
  el.innerHTML = `<b>${esc(t)}</b>${b?'<span>'+esc(b)+'</span>':''}`;
  document.getElementById('toast').appendChild(el);
  setTimeout(()=>el.classList.add('out'),4500);
  setTimeout(()=>el.remove(),5000);
}

/* ---------------- Boot ---------------- */
$typeSel.addEventListener('change', ()=> newDilekce($typeSel.value));
$tabs.addEventListener('click', e=>{ const b=e.target.closest('.tab'); if(b) showTab(b.dataset.tab); });
document.getElementById('copyBtn').addEventListener('click', copyPreview);
document.getElementById('dlBtn').addEventListener('click', downloadPreview);
document.getElementById('printBtn').addEventListener('click', printPreview);
document.getElementById('saveBtn').addEventListener('click', saveCurrent);
document.getElementById('savedSearch').addEventListener('input', renderSaved);
document.getElementById('savedList').addEventListener('click', e=>{
  const open = e.target.closest('[data-open]'); if (open){ switchLoad(open.dataset.open); }
  const cp = e.target.closest('[data-copy]'); if (cp){
    const r = storage.saved.find(x=>x.id===cp.dataset.copy);
    if (r) navigator.clipboard.writeText(r.text).then(()=>toast('Kopyalandı', r.name, 'ok'));
  }
  const dl = e.target.closest('[data-del]'); if (dl){
    if (!confirm('Kayıt silinsin mi?')) return;
    storage.saved = storage.saved.filter(x=>x.id!==dl.dataset.del);
    saveStore(); renderSaved();
    toast('Silindi','','warn');
  }
});
document.addEventListener('keydown', e=>{
  if ((e.ctrlKey||e.metaKey) && e.key==='s'){ e.preventDefault(); saveCurrent(); }
  if ((e.ctrlKey||e.metaKey) && e.key==='p'){ e.preventDefault(); printPreview(); }
});

if ('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  window.deferredPrompt = e;
  document.getElementById('installBtn').classList.remove('hidden');
});
document.getElementById('installBtn').addEventListener('click', ()=>{
  if (window.deferredPrompt){ window.deferredPrompt.prompt(); }
});

newDilekce('dava');
renderSaved();
renderPreview();