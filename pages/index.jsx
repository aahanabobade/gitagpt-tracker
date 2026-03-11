import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

const LAYER = { fe:'Frontend', be:'Backend', full:'Full Stack', ai:'AI / ML' }
const PRI   = { mvp:'MVP', v2:'V2', v3:'V3' }
const STATUS = { todo:'Todo', in_progress:'In Progress', done:'Done' }

const C = {
  fe:   { bg:'rgba(42,100,150,.18)',  color:'#7ec8e3', border:'rgba(42,100,150,.35)' },
  be:   { bg:'rgba(39,174,96,.15)',   color:'#7debb0', border:'rgba(39,174,96,.3)'   },
  full: { bg:'rgba(139,68,172,.15)',  color:'#d4a8f0', border:'rgba(139,68,172,.3)'  },
  ai:   { bg:'rgba(232,130,12,.12)',  color:'#ffd580', border:'rgba(232,130,12,.25)' },
  mvp:  { bg:'rgba(39,174,96,.15)',   color:'#7debb0', border:'rgba(39,174,96,.25)'  },
  v2:   { bg:'rgba(201,168,76,.12)',  color:'#f0d080', border:'rgba(201,168,76,.2)'  },
  v3:   { bg:'rgba(127,140,141,.1)',  color:'rgba(200,200,200,.5)', border:'rgba(127,140,141,.2)' },
  todo: { bg:'rgba(127,140,141,.1)',  color:'rgba(200,200,200,.6)', border:'rgba(127,140,141,.2)' },
  in_progress: { bg:'rgba(201,168,76,.12)', color:'#f0d080', border:'rgba(201,168,76,.2)' },
  done: { bg:'rgba(39,174,96,.15)',   color:'#7debb0', border:'rgba(39,174,96,.25)'  },
}

const EMPTY = { name:'', description:'', layer:'fe', tech:'', priority:'mvp', status:'todo', assigned_to:'' }

export default function Home() {
  const [tasks, setTasks]     = useState([])
  const [name, setName]       = useState('')
  const [joined, setJoined]   = useState(false)
  const [form, setForm]       = useState(EMPTY)
  const [editId, setEditId]   = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter]   = useState('all')
  const [toast, setToast]     = useState(null)
  const [loading, setLoading] = useState(true)

  // Load name from localStorage
  useEffect(() => {
    const n = localStorage.getItem('gitagpt_name')
    if (n) { setName(n); setJoined(true) }
  }, [])

  // Fetch + real-time
  useEffect(() => {
    if (!joined) return
    fetchTasks()
    const channel = supabase
      .channel('tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [joined])

  async function fetchTasks() {
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  async function saveTask() {
    if (!form.name.trim()) return
    const payload = {
      ...form,
      tech: form.tech.split(',').map(t => t.trim()).filter(Boolean),
      updated_at: new Date().toISOString(),
    }
    if (editId) {
      await supabase.from('tasks').update(payload).eq('id', editId)
      toast_('Updated ✓')
    } else {
      await supabase.from('tasks').insert({ ...payload, created_by: name })
      toast_('Task added 🙏')
    }
    setForm(EMPTY); setEditId(null); setShowForm(false)
  }

  async function deleteTask(id) {
    await supabase.from('tasks').delete().eq('id', id)
    toast_('Deleted')
  }

  async function cycleStatus(task) {
    const order = ['todo','in_progress','done']
    const next = order[(order.indexOf(task.status) + 1) % 3]
    await supabase.from('tasks').update({ status: next, updated_at: new Date().toISOString() }).eq('id', task.id)
  }

  function openEdit(t) {
    setForm({ name:t.name, description:t.description||'', layer:t.layer, tech:(t.tech||[]).join(', '), priority:t.priority, status:t.status, assigned_to:t.assigned_to||'' })
    setEditId(t.id); setShowForm(true)
  }

  function toast_(msg) { setToast(msg); setTimeout(() => setToast(null), 2200) }

  const filtered = tasks.filter(t => {
    if (filter === 'all') return true
    if (['fe','be','full','ai'].includes(filter)) return t.layer === filter
    if (['mvp','v2','v3'].includes(filter)) return t.priority === filter
    if (['todo','in_progress','done'].includes(filter)) return t.status === filter
    return true
  })

  const stats = {
    total: tasks.length,
    done:  tasks.filter(t => t.status === 'done').length,
    mvp:   tasks.filter(t => t.priority === 'mvp').length,
  }

  // ── Join screen ──
  if (!joined) return (
    <div style={S.root}>
      <Head><title>GitaGPT Tracker</title></Head>
      <div style={S.joinWrap}>
        <div style={S.om}>ॐ</div>
        <h1 style={S.h1}>GitaGPT Tracker</h1>
        <p style={S.sub}>Enter your name to collaborate</p>
        <input
          autoFocus value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { localStorage.setItem('gitagpt_name', name.trim()); setJoined(true) }}}
          placeholder="Your name…" style={S.joinInput}
        />
        <button onClick={() => { if (name.trim()) { localStorage.setItem('gitagpt_name', name.trim()); setJoined(true) }}} style={S.joinBtn}>
          Enter 🙏
        </button>
      </div>
    </div>
  )

  return (
    <div style={S.root}>
      <Head><title>GitaGPT Tracker</title></Head>

      {toast && <div style={S.toast}>{toast}</div>}

      {/* Header */}
      <div style={S.header}>
        <div style={S.om}>ॐ</div>
        <h1 style={S.h1}>GitaGPT Tracker</h1>
        <div style={S.headerRow}>
          <span style={S.nameBadge}>👤 {name}</span>
          <button onClick={() => { setForm(EMPTY); setEditId(null); setShowForm(true) }} style={S.addBtn}>+ Add Task</button>
        </div>
      </div>

      {/* Stats */}
      <div style={S.statsRow}>
        {[['Total', stats.total, '#c9a84c'], ['Done', stats.done, '#7debb0'], ['MVP', stats.mvp, '#f0d080']].map(([l,n,c]) => (
          <div key={l} style={S.statBox}>
            <div style={{...S.statNum, color:c}}>{n}</div>
            <div style={S.statLabel}>{l}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={S.filters}>
        {['all','fe','be','full','ai','mvp','v2','v3','todo','in_progress','done'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{...S.fBtn, ...(filter===f?S.fActive:{})}}>
            {f==='in_progress'?'In Progress':f==='full'?'Full Stack':f==='ai'?'AI/ML':f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div style={S.formCard}>
          <h3 style={S.formTitle}>{editId ? 'Edit Task' : 'New Task'}</h3>
          <div style={S.formGrid}>
            <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Task name *" style={S.inp} />
            <input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Description" style={S.inp} />
            <input value={form.tech} onChange={e=>setForm({...form,tech:e.target.value})} placeholder="Tech stack (comma separated)" style={S.inp} />
            <input value={form.assigned_to} onChange={e=>setForm({...form,assigned_to:e.target.value})} placeholder="Assign to…" style={S.inp} />
            <div style={S.selRow}>
              {[['layer', LAYER], ['priority', PRI], ['status', STATUS]].map(([key, map]) => (
                <select key={key} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} style={S.sel}>
                  {Object.entries(map).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ))}
            </div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <button onClick={saveTask} style={S.saveBtn}>{editId?'Update':'Add Task'}</button>
            <button onClick={()=>{setShowForm(false);setForm(EMPTY);setEditId(null)}} style={S.cancelBtn}>Cancel</button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div style={S.list}>
        {loading && <div style={S.empty}>Loading…</div>}
        {!loading && filtered.length === 0 && <div style={S.empty}>No tasks yet. Add one! 🙏</div>}
        {filtered.map(t => (
          <div key={t.id} style={{...S.card, ...(t.status==='done'?S.cardDone:{})}}>
            <div style={S.cardTop}>
              <div>
                <div style={S.taskName}>{t.name}</div>
                {t.description && <div style={S.taskDesc}>{t.description}</div>}
              </div>
              <div style={S.cardActions}>
                <button onClick={()=>cycleStatus(t)} style={{...S.badge, background:C[t.status]?.bg, color:C[t.status]?.color, border:`1px solid ${C[t.status]?.border}`, cursor:'pointer'}} title="Click to advance status">
                  {STATUS[t.status]}
                </button>
                <button onClick={()=>openEdit(t)} style={S.iconBtn}>✎</button>
                <button onClick={()=>deleteTask(t.id)} style={{...S.iconBtn, color:'rgba(255,80,80,.5)'}}>✕</button>
              </div>
            </div>
            <div style={S.cardMeta}>
              <span style={{...S.badge, background:C[t.layer]?.bg, color:C[t.layer]?.color, border:`1px solid ${C[t.layer]?.border}`}}>{LAYER[t.layer]}</span>
              <span style={{...S.badge, background:C[t.priority]?.bg, color:C[t.priority]?.color, border:`1px solid ${C[t.priority]?.border}`}}>{PRI[t.priority]}</span>
              {(t.tech||[]).map((tech,i) => <span key={i} style={S.tech}>{tech}</span>)}
              {t.assigned_to && <span style={S.assigned}>👤 {t.assigned_to}</span>}
              {t.created_by && <span style={S.createdBy}>by {t.created_by}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const S = {
  root:      { minHeight:'100vh', background:'#08050a', fontFamily:"'Georgia', serif", color:'rgba(240,208,128,.85)', padding:'0 0 80px' },
  om:        { fontSize:20, color:'rgba(201,168,76,.4)', textAlign:'center', paddingTop:32 },
  h1:        { fontFamily:"Georgia, serif", fontSize:'clamp(16px,2.5vw,22px)', fontWeight:400, color:'#c9a84c', textAlign:'center', letterSpacing:'.08em', margin:'6px 0 12px' },
  sub:       { textAlign:'center', fontSize:13, color:'rgba(240,208,128,.35)', fontStyle:'italic', marginBottom:24 },
  header:    { padding:'0 24px 16px' },
  headerRow: { display:'flex', justifyContent:'space-between', alignItems:'center', maxWidth:900, margin:'0 auto' },
  nameBadge: { fontSize:13, color:'rgba(240,208,128,.5)', fontStyle:'italic' },
  addBtn:    { padding:'8px 20px', borderRadius:30, border:'1px solid rgba(201,168,76,.3)', background:'rgba(201,168,76,.1)', color:'#c9a84c', cursor:'pointer', fontSize:13, letterSpacing:'.05em' },
  statsRow:  { display:'flex', gap:12, justifyContent:'center', padding:'0 24px 20px', flexWrap:'wrap' },
  statBox:   { padding:'10px 20px', borderRadius:12, border:'1px solid rgba(201,168,76,.1)', background:'rgba(201,168,76,.03)', textAlign:'center', minWidth:80 },
  statNum:   { fontSize:22, fontWeight:400 },
  statLabel: { fontSize:10, letterSpacing:'.1em', color:'rgba(201,168,76,.35)', textTransform:'uppercase', marginTop:2 },
  filters:   { display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center', padding:'0 24px 20px', maxWidth:900, margin:'0 auto' },
  fBtn:      { padding:'5px 12px', borderRadius:20, border:'1px solid rgba(201,168,76,.12)', background:'transparent', color:'rgba(240,208,128,.35)', cursor:'pointer', fontSize:11, letterSpacing:'.04em' },
  fActive:   { background:'rgba(201,168,76,.1)', borderColor:'#c9a84c', color:'#c9a84c' },
  formCard:  { maxWidth:900, margin:'0 auto 20px', padding:'24px', background:'rgba(255,255,255,.03)', border:'1px solid rgba(201,168,76,.15)', borderRadius:16, marginLeft:24, marginRight:24 },
  formTitle: { fontSize:15, color:'#c9a84c', marginBottom:16, fontWeight:400, letterSpacing:'.06em' },
  formGrid:  { display:'flex', flexDirection:'column', gap:10 },
  inp:       { padding:'9px 14px', borderRadius:8, border:'1px solid rgba(201,168,76,.15)', background:'rgba(0,0,0,.3)', color:'rgba(240,208,128,.85)', fontSize:13, outline:'none', fontFamily:'Georgia, serif' },
  selRow:    { display:'flex', gap:10, flexWrap:'wrap' },
  sel:       { flex:1, minWidth:120, padding:'8px 12px', borderRadius:8, border:'1px solid rgba(201,168,76,.15)', background:'#111', color:'#f0d080', fontSize:12, cursor:'pointer' },
  saveBtn:   { padding:'9px 24px', borderRadius:30, border:'1px solid rgba(39,174,96,.3)', background:'rgba(39,174,96,.12)', color:'#7debb0', cursor:'pointer', fontSize:13 },
  cancelBtn: { padding:'9px 16px', borderRadius:30, border:'1px solid rgba(255,80,80,.15)', background:'transparent', color:'rgba(255,80,80,.4)', cursor:'pointer', fontSize:13 },
  list:      { maxWidth:900, margin:'0 auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:10 },
  card:      { padding:'16px 20px', borderRadius:14, border:'1px solid rgba(201,168,76,.1)', background:'rgba(255,255,255,.025)', transition:'background .2s' },
  cardDone:  { opacity:.55 },
  cardTop:   { display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:10 },
  taskName:  { fontSize:15, color:'rgba(240,208,128,.9)', fontWeight:400, marginBottom:3 },
  taskDesc:  { fontSize:12, color:'rgba(255,255,255,.3)', fontStyle:'italic', lineHeight:1.4 },
  cardActions:{ display:'flex', gap:6, alignItems:'center', flexShrink:0, flexWrap:'wrap' },
  cardMeta:  { display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' },
  badge:     { display:'inline-block', padding:'3px 10px', borderRadius:20, fontSize:10, letterSpacing:'.05em', fontFamily:'monospace', whiteSpace:'nowrap' },
  tech:      { padding:'2px 8px', borderRadius:6, fontSize:10, background:'rgba(255,255,255,.05)', color:'rgba(255,255,255,.4)', border:'1px solid rgba(255,255,255,.08)', fontFamily:'monospace' },
  assigned:  { fontSize:11, color:'rgba(201,168,76,.5)', fontStyle:'italic' },
  createdBy: { fontSize:10, color:'rgba(255,255,255,.2)', fontStyle:'italic', marginLeft:'auto' },
  iconBtn:   { background:'none', border:'none', color:'rgba(201,168,76,.4)', cursor:'pointer', fontSize:14, padding:'2px 6px' },
  empty:     { textAlign:'center', padding:40, color:'rgba(255,255,255,.2)', fontStyle:'italic' },
  toast:     { position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'rgba(20,20,15,.95)', border:'1px solid rgba(201,168,76,.3)', color:'#c9a84c', padding:'10px 22px', borderRadius:30, fontSize:12, fontFamily:'monospace', zIndex:999, letterSpacing:'.06em' },
  joinWrap:  { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', padding:24 },
  joinInput: { width:'100%', maxWidth:320, padding:'12px 16px', borderRadius:10, border:'1px solid rgba(201,168,76,.2)', background:'rgba(0,0,0,.4)', color:'rgba(240,208,128,.9)', fontSize:15, outline:'none', textAlign:'center', marginBottom:12, fontFamily:'Georgia, serif' },
  joinBtn:   { padding:'11px 32px', borderRadius:30, border:'1px solid rgba(201,168,76,.4)', background:'rgba(201,168,76,.12)', color:'#c9a84c', cursor:'pointer', fontSize:14, letterSpacing:'.08em' },
}