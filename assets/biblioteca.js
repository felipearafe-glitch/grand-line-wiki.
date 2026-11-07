(()=> {
  const grid=document.getElementById('character-grid');
  const input=document.getElementById('character-search');
  const count=document.getElementById('character-count');
  const empty=document.getElementById('empty-state');
  const alphabet=document.getElementById('alphabet-filter');
  const resultsTitle=document.getElementById('results-title');
  const randomButton=document.getElementById('random-character');
  const norm=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g,'');
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let data=[],remoteMap=new Map(),localPages={},editorial={},activeLetter='Todos';
  const letters=['Todos',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
  const externalFicha=name=>'https://onepiece.fandom.com/wiki/'+encodeURIComponent(name.trim().replace(/ /g,'_'));
  const localized=v=>typeof v==='string'?v:(v&&(v.en||v.english||v.romaji||v.jp||v.name||v.pt))||'';
  const asText=v=>Array.isArray(v)?v.map(x=>typeof x==='string'?x:localized(x)).filter(Boolean).join(', '):typeof v==='string'?v:localized(v);
  const getImage=c=>{
    if(!c)return '';
    const raw=c.image_url||c.imageUrl||c.avatarSrc||c.avatar||c.image||c.img||c.portrait||'';
    return typeof raw==='string'?raw:(raw&&typeof raw==='object'?(raw.url||raw.src||raw.original||''):'');
  };
  function factsFor(c){
    const e=c.extra_data||c.extraData||{};
    const parts=[];
    const epithet=asText(e.epithet||e.nickname||e.alias);
    const occupation=asText(e.occupation||e.role||e.profession);
    const affiliation=asText(e.affiliation||e.affiliations||e.crew||e.organization);
    const origin=asText(e.origin||e.birthplace);
    const debut=asText(e.first_appearance||e.debut);
    if(epithet) parts.push('Epíteto: '+epithet+'.');
    if(occupation) parts.push('Atuação: '+occupation+'.');
    if(affiliation) parts.push('Vínculo: '+affiliation+'.');
    if(origin) parts.push('Origem: '+origin+'.');
    if(debut) parts.push('Estreia: '+debut+'.');
    return parts.join(' ');
  }

  // Apelidos usados para associar nomes alternativos ao registro correto.
  // Só exibimos imagens fornecidas pelo registro do próprio personagem.
  const imageAliases={
    'Ace':['Portgas D. Ace','Portgas Ace'],'Aokiji':['Kuzan'],'Akainu':['Sakazuki'],
    'Kizaru':['Borsalino'],'Aramaki':['Ryokugyu'],'Barba Negra':['Marshall D. Teach','Blackbeard'],
    'Blackbeard':['Marshall D. Teach'],'Chopper':['Tony Tony Chopper'],
    'Tony Tony Chopper':['Chopper'],'Bon Clay':['Bentham','Mr. 2 Bon Kurei'],
    'Mr. 2 Bon Kurei':['Bentham','Bon Clay'],'Hancock':['Boa Hancock'],
    'Whitebeard':['Edward Newgate','Barba Branca'],'Barba Branca':['Edward Newgate','Whitebeard'],
    'Law':['Trafalgar D. Water Law','Trafalgar Law'],'Trafalgar Law':['Trafalgar D. Water Law','Law'],
    'Kid':['Eustass Kid'],'Momonosuke':['Kozuki Momonosuke'],'Oden':['Kozuki Oden'],
    'Jinbe':['Jimbei'],'Rayleigh':['Silvers Rayleigh'],'X Drake':['Drake'],
    'Big Mom':['Charlotte Linlin'],'Charlotte Linlin':['Big Mom']
  };
  function imageFor(name){
    const c=remoteMap.get(norm(name));
    return c?getImage(c):'';
  }
  function placeholder(name){
    return '<span class="initial" aria-hidden="true">'+esc((name||'?').trim().charAt(0).toUpperCase())+'</span>';
  }
  function portrait(name){
    const url=imageFor(name);
    const base=placeholder(name);
    if(!url)return base;
    return base+'<img loading="lazy" decoding="async" src="'+esc(url)+'" alt="Retrato de '+esc(name)+'" referrerpolicy="no-referrer" onerror="this.hidden=true">';
  }
  function makeAlphabet(){
    alphabet.innerHTML=letters.map(l=>'<button type="button" data-letter="'+l+'" class="'+(l===activeLetter?'active':'')+'" aria-pressed="'+(l===activeLetter)+'">'+(l==='Todos'?'Todos':l)+'</button>').join('');
    alphabet.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
      activeLetter=b.dataset.letter;
      makeAlphabet();render();
    }));
  }
  function render(){
    const q=norm(input.value);
    const found=data.filter(x=>{
      const byLetter=activeLetter==='Todos'||x.name.toLocaleUpperCase('en').startsWith(activeLetter);
      const aliases=(editorial.aliases||{})[x.name]||[];
      const searchable=[x.name,...aliases].some(s=>norm(s).includes(q));
      return byLetter&&(!q||searchable);
    });
    count.textContent=found.length+' de '+data.length+' fichas';
    resultsTitle.textContent=activeLetter==='Todos'?'Arquivo completo':'Personagens: '+activeLetter;
    empty.hidden=found.length!==0;
    grid.innerHTML=found.map(x=>{
      const c=remoteMap.get(norm(x.name));
      const image=(c&&getImage(c))||'';
      const fallbacks=imageCandidates(x.name);
      if(image) fallbacks.unshift(image);
      const apiDescription=c&&(c.editorial_description||c.description);
      const bio=(editorial.bios||{})[x.name]||apiDescription||factsFor(c)||('Estamos reunindo fontes verificadas para completar o perfil de '+x.name+'.');
      const tags=[];
      const e=c&&(c.extra_data||c.extraData)||{};
      const role=asText(e.occupation||e.role||e.profession);
      const crew=asText(e.affiliation||e.crew||e.organization);
      if(role)tags.push(role.split(',')[0]);
      if(crew)tags.push(crew.split(',')[0]);
      const href=localPages[x.name]||externalFicha(x.name);
      const art=portrait(x.name);
      return '<a class="character-card" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer" aria-label="Abrir ficha de '+esc(x.name)+' em nova aba"><div class="character-art">'+art+'</div><div class="character-copy"><span class="character-index">ARQUIVO #'+String(x.id).padStart(3,'0')+'</span><h3>'+esc(x.name)+'</h3><p>'+esc(bio)+'</p>'+(tags.length?'<div class="character-meta">'+tags.slice(0,2).map(t=>'<span class="character-tag">'+esc(t)+'</span>').join('')+'</div>':'')+'<span class="card-open">EXPLORAR FICHA ↗</span></div></a>';
    }).join('');
  }
  function extractRows(payload){
    if(Array.isArray(payload))return payload;
    if(Array.isArray(payload?.data))return payload.data;
    if(Array.isArray(payload?.data?.characters))return payload.data.characters;
    if(Array.isArray(payload?.data?.results))return payload.data.results;
    if(Array.isArray(payload?.characters))return payload.characters;
    if(Array.isArray(payload?.results))return payload.results;
    return [];
  }
  function indexCharacter(c,legacy=false){
    const name=localized(c.name||c.englishName||c.english_name||c.full_name||c.title);
    if(!name)return;
    const aliases=[name];
    const e=c.extra_data||c.extraData||{};
    const extraAliases=e.aliases||c.aliases||[];
    if(Array.isArray(extraAliases))aliases.push(...extraAliases.map(localized));
    else if(typeof extraAliases==='string')aliases.push(...extraAliases.split(/[;,]/));
    const image=getImage(c);
    Object.entries(editorial.aliases||{}).forEach(([canonical,list])=>{
      if(norm(canonical)===norm(name))aliases.push(canonical,...list);
      if((list||[]).some(a=>norm(a)===norm(name)))aliases.push(canonical);
    });
    Object.entries(imageAliases).forEach(([canonical,list])=>{
      if(norm(canonical)===norm(name))aliases.push(canonical,...list);
      if((list||[]).some(a=>norm(a)===norm(name)))aliases.push(canonical);
    });
    aliases.forEach(alias=>{
      const key=norm(alias);
      if(!key)return;
      const current=remoteMap.get(key)||{};
      if(image&&!getImage(current))current.image_url=image;
      const desc=c.description||c.editorial_description;
      if(desc&&!current.editorial_description)current.editorial_description=desc;
      if(c.extra_data||c.extraData)current.extra_data=c.extra_data||c.extraData;
      remoteMap.set(key,current);
    });
  }
  async function loadOnePieceApi(){
    const base='https://www.onepieceapi.com/api/characters';
    // Percorre até 16 páginas de 100 registros para cobrir o catálogo inteiro.
    for(let page=1;page<=16;page++){
      const response=await fetch(base+'?page='+page+'&limit=100',{headers:{Accept:'application/json'}});
      if(!response.ok)throw Error('API indisponível');
      const rows=extractRows(await response.json());
      rows.forEach(c=>indexCharacter(c));
      if(page===1||page%3===0)render();
      if(rows.length<100)break;
    }
    render();
  }
  async function loadOnePieceQL(){
    const endpoint='https://onepieceql.up.railway.app/graphql';
    const query=page=>'{ characters(filter: {"page": '+page+'}) { info { pages } results { englishName avatarSrc description } } }';
    const first=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:query(1)})});
    if(!first.ok)throw Error('Fonte secundária indisponível');
    const body=await first.json(),block=body.data&&body.data.characters;
    if(!block)return;
    (block.results||[]).forEach(c=>indexCharacter({name:c.englishName,avatarSrc:c.avatarSrc,description:c.description}));
    render();
    const pages=Math.min(block.info&&block.info.pages||1,30);
    for(let page=2;page<=pages;page++){
      try{
        const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:query(page)})});
        if(!r.ok)break;
        const b=await r.json(),rows=b.data&&b.data.characters&&b.data.characters.results||[];
        rows.forEach(c=>indexCharacter({name:c.englishName,avatarSrc:c.avatarSrc,description:c.description}));
      }catch(_e){break;}
    }
    render();
  }
  Promise.all([
    fetch('assets/characters-500.json').then(r=>{if(!r.ok)throw Error('catálogo');return r.json()}),
    fetch('assets/character-pages.json').then(r=>r.ok?r.json():{}).catch(()=>({})),
    fetch('assets/character-editorial.json').then(r=>r.ok?r.json():{}).catch(()=>({}))
  ]).then(([x,pages,ed])=>{
    data=x.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'}));
    localPages=pages;editorial=ed;
    makeAlphabet();render();
    // Tenta as duas fontes independentemente: uma falha não cancela a outra.
    loadOnePieceApi().catch(()=>{});
    loadOnePieceQL().catch(()=>{});
  }).catch(()=>{
    count.textContent='Falha ao carregar o catálogo';
    empty.hidden=false;
    empty.textContent='Não foi possível carregar a biblioteca. Atualize a página.';
  });
  input.addEventListener('input',render);
  randomButton.addEventListener('click',()=>{
    if(!data.length)return;
    activeLetter='Todos';input.value='';
    makeAlphabet();
    const chosen=data[Math.floor(Math.random()*data.length)];
    render();
    const card=[...grid.querySelectorAll('.character-card')].find(a=>a.getAttribute('aria-label')?.includes(chosen.name));
    card?.scrollIntoView({behavior:'smooth',block:'center'});
    card?.focus({preventScroll:true});
  });
})();