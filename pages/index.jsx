import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

const CORRECT_PIN = process.env.NEXT_PUBLIC_APP_PIN || '2808'

const PALETTE = [
  '#c9a84c', // gold
  '#7ec8e3', // blue
  '#7debb0', // green
  '#d4a8f0', // purple
  '#ffd580', // yellow
  '#f08080', // coral
  '#80d4f0', // sky
  '#f0a080', // peach
  '#a0f080', // lime
  '#f080d0', // pink
]

const LAYER  = { fe:'Frontend', be:'Backend', full:'Full Stack', ai:'AI / ML' }
const PRI    = { mvp:'MVP', v2:'V2', v3:'V3' }
const STATUS = { todo:'Todo', in_progress:'In Progress', done:'Done' }
const EMPTY  = { name:'', description:'', layer:'fe', tech:'', priority:'mvp', status:'todo', assigned_to:'' }

const C = {
  fe:          { bg:'rgba(42,100,150,.18)',  color:'#7ec8e3', border:'rgba(42,100,150,.35)'  },
  be:          { bg:'rgba(39,174,96,.15)',   color:'#7debb0', border:'rgba(39,174,96,.3)'    },
  full:        { bg:'rgba(139,68,172,.15)',  color:'#d4a8f0', border:'rgba(139,68,172,.3)'   },
  ai:          { bg:'rgba(232,130,12,.12)',  color:'#ffd580', border:'rgba(232,130,12,.25)'  },
  mvp:         { bg:'rgba(39,174,96,.15)',   color:'#7debb0', border:'rgba(39,174,96,.25)'   },
  v2:          { bg:'rgba(201,168,76,.12)',  color:'#f0d080', border:'rgba(201,168,76,.2)'   },
  v3:          { bg:'rgba(127,140,141,.1)',  color:'rgba(200,200,200,.5)', border:'rgba(127,140,141,.2)' },
  todo:        { bg:'rgba(127,140,141,.1)',  color:'rgba(200,200,200,.6)', border:'rgba(127,140,141,.2)' },
  in_progress: { bg:'rgba(201,168,76,.12)',  color:'#f0d080', border:'rgba(201,168,76,.2)'   },
  done:        { bg:'rgba(39,174,96,.15)',   color:'#7debb0', border:'rgba(39,174,96,.25)'   },
}

const FILTERS = [
  { key:'all',         label:'All'         },
  { key:'fe',          label:'Frontend'    },
  { key:'be',          label:'Backend'     },
  { key:'full',        label:'Full Stack'  },
  { key:'ai',          label:'AI / ML'     },
  { key:'mvp',         label:'MVP'         },
  { key:'v2',          label:'V2'          },
  { key:'v3',          label:'V3'          },
  { key:'todo',        label:'Todo'        },
  { key:'in_progress', label:'In Progress' },
  { key:'done',        label:'Done'        },
]

export default function Home() {
  const [pin,       setPin]       = useState('')
  const [pinOk,     setPinOk]     = useState(false)
  const [pinErr,    setPinErr]    = useState(false)
  const [tasks,     setTasks]     = useState([])
  const [members,   setMembers]   = useState([])   // [{ id, name, color }]
  const [name,      setName]      = useState('')
  const [joined,    setJoined]    = useState(false)
  const [myColor,   setMyColor]   = useState('#c9a84c')
  const [form,      setForm]      = useState(EMPTY)
  const [editId,    setEditId]    = useState(null)
  const [showForm,  setShowForm]  = useState(false)
  const [showTeam,  setShowTeam]  = useState(false)
  const [filter,    setFilter]    = useState('all')
  const [toast,     setToast]     = useState(null)
  const [loading,   setLoading]   = useState(true)

  // ── Init ──
  useEffect(() => {
    const ok = sessionStorage.getItem('gitagpt_pin_ok')
    if (ok) setPinOk(true)
    const n  = localStorage.getItem('gitagpt_name')
    const c  = localStorage.getItem('gitagpt_color') || '#c9a84c'
    if (n) { setName(n); setMyColor(c); setJoined(true) }
  }, [])

  // ── Supabase subscriptions ──
  useEffect(() => {
    if (!joined) return
    fetchTasks()
    fetchMembers()
    const ch = supabase
      .channel('realtime-all')
      .on('postgres_changes', { event:'*', schema:'public', table:'tasks' },   fetchTasks)
      .on('postgres_changes', { event:'*', schema:'public', table:'members' }, fetchMembers)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [joined])

  async function fetchTasks() {
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  async function fetchMembers() {
    const { data } = await supabase.from('members').select('*').order('joined_at')
    setMembers(data || [])
  }

  // ── PIN ──
  function checkPin() {
    if (pin === CORRECT_PIN) {
      sessionStorage.setItem('gitagpt_pin_ok', '1')
      setPinOk(true); setPinErr(false)
    } else {
      setPinErr(true); setPin('')
    }
  }

  // ── Join (upsert member) ──
  async function join() {
    if (!name.trim()) return
    const color = myColor
    localStorage.setItem('gitagpt_name',  name.trim())
    localStorage.setItem('gitagpt_color', color)
    // upsert so re-joining keeps same row
    await supabase.from('members').upsert({ name: name.trim(), color }, { onConflict: 'name' })
    setJoined(true)
  }

  // ── Update a member's color ──
  async function updateColor(member, newColor) {
    await supabase.from('members').update({ color: newColor }).eq('id', member.id)
    // if it's me, update locally too
    if (member.name === name) {
      setMyColor(newColor)
      localStorage.setItem('gitagpt_color', newColor)
    }
    flash('Color updated ✓')
  }

  // ── Remove a member ──
  async function removeMember(member) {
    await supabase.from('members').delete().eq('id', member.id)
    flash(`${member.name} removed`)
  }

  // ── Tasks ──
  async function saveTask() {
    if (!form.name.trim()) return
    const payload = {
      ...form,
      tech: form.tech.split(',').map(t => t.trim()).filter(Boolean),
      updated_at: new Date().toISOString(),
    }
    if (editId) {
      await supabase.from('tasks').update(payload).eq('id', editId)
      flash('Updated ✓')
    } else {
      await supabase.from('tasks').insert({ ...payload, created_by: name })
      flash('Task added 🙏')
    }
    setForm(EMPTY); setEditId(null); setShowForm(false)
  }

  async function deleteTask(id) {
    await supabase.from('tasks').delete().eq('id', id)
    flash('Deleted')
  }

  async function cycleStatus(task) {
    const order = ['todo','in_progress','done']
    const next  = order[(order.indexOf(task.status) + 1) % 3]
    await supabase.from('tasks').update({ status: next, updated_at: new Date().toISOString() }).eq('id', task.id)
  }

  function openEdit(t) {
    setForm({ name:t.name, description:t.description||'', layer:t.layer, tech:(t.tech||[]).join(', '), priority:t.priority, status:t.status, assigned_to:t.assigned_to||'' })
    setEditId(t.id); setShowForm(true); setShowTeam(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function flash(msg) { setToast(msg); setTimeout(() => setToast(null), 2400) }

  // helper: get color for a name
  function colorOf(n) {
    const m = members.find(m => m.name === n)
    return m?.color || 'rgba(255,255,255,.35)'
  }

  const filtered = tasks.filter(t => {
    if (filter === 'all')                               return true
    if (['fe','be','full','ai'].includes(filter))       return t.layer    === filter
    if (['mvp','v2','v3'].includes(filter))             return t.priority === filter
    if (['todo','in_progress','done'].includes(filter)) return t.status   === filter
    return true
  })

  const stats = { total: tasks.length, done: tasks.filter(t=>t.status==='done').length, mvp: tasks.filter(t=>t.priority==='mvp').length }

  const meta = <Head><title>GitaGPT Tracker</title><meta name="viewport" content="width=device-width,initial-scale=1"/></Head>

  // ── PIN screen ───────────────────────────────────────────────────────────────
  if (!pinOk) return (
    <div className="root">{meta}<Styles/>
      <div className="join-wrap">
        <div className="om">ॐ</div>
        <h1 className="h1">GitaGPT Tracker</h1>
        <p className="sub">Enter PIN to continue</p>
        <input autoFocus type="password" inputMode="numeric" maxLength={4}
          value={pin} onChange={e=>{setPin(e.target.value);setPinErr(false)}}
          onKeyDown={e=>e.key==='Enter'&&checkPin()}
          placeholder="● ● ● ●" className={`join-input${pinErr?' inp-err':''}`}/>
        {pinErr && <p className="pin-err">Wrong PIN. Try again.</p>}
        <button onClick={checkPin} className="join-btn">Unlock 🔐</button>
      </div>
    </div>
  )

  // ── Name + color pick screen ─────────────────────────────────────────────────
  if (!joined) return (
    <div className="root">{meta}<Styles/>
      <div className="join-wrap">
        <div className="om">ॐ</div>
        <h1 className="h1">GitaGPT Tracker</h1>
        <p className="sub">Pick your name & colour</p>
        <input autoFocus value={name} onChange={e=>setName(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&join()}
          placeholder="Your name…" className="join-input"/>
        <div className="color-pick-label">Your colour</div>
        <div className="color-grid">
          {PALETTE.map(c => (
            <div key={c} onClick={()=>setMyColor(c)}
              className={`color-dot${myColor===c?' selected':''}`}
              style={{background:c, boxShadow: myColor===c ? `0 0 0 3px rgba(255,255,255,.25), 0 0 12px ${c}88` : 'none'}}/>
          ))}
        </div>
        <button onClick={join} className="join-btn" style={{borderColor:`${myColor}66`, color:myColor}}>
          Enter 🙏
        </button>
      </div>
    </div>
  )

  // ── Main app ─────────────────────────────────────────────────────────────────
  return (
    <div className="root">{meta}<Styles/>
      {toast && <div className="toast">{toast}</div>}

      {/* Header */}
      <header className="header">
        <div className="om">ॐ</div>
        <h1 className="h1">GitaGPT Tracker</h1>
        <div className="header-row">
          <span className="name-badge" style={{color: myColor}}>
            <span className="dot" style={{background:myColor}}/>
            {name}
          </span>
          <div className="header-btns">
            <button className="team-btn" onClick={()=>{setShowTeam(s=>!s);setShowForm(false)}}>
              👥 Team ({members.length})
            </button>
            <button className="add-btn" onClick={()=>{setForm(EMPTY);setEditId(null);setShowForm(s=>!s);setShowTeam(false)}}>
              {showForm ? '✕ Close' : '+ Add Task'}
            </button>
          </div>
        </div>
      </header>

      {/* Team panel */}
      {showTeam && (
        <div className="team-panel">
          <h3 className="form-title">Team Members</h3>
          {members.length === 0 && <p className="empty" style={{padding:'12px 0'}}>No members yet</p>}
          <div className="member-list">
            {members.map(m => (
              <div key={m.id} className="member-row">
                <span className="dot" style={{background:m.color, width:12, height:12}}/>
                <span className="member-name" style={{color:m.color}}>{m.name}</span>
                {m.name === name && <span className="you-tag">you</span>}
                <div className="member-colors">
                  {PALETTE.map(c => (
                    <div key={c} onClick={()=>updateColor(m,c)}
                      className={`color-dot sm${m.color===c?' selected':''}`}
                      style={{background:c, boxShadow: m.color===c ? `0 0 0 2px rgba(255,255,255,.3)` : 'none'}}/>
                  ))}
                </div>
                <button className="icon-btn danger" onClick={()=>removeMember(m)} title="Remove">✕</button>
              </div>
            ))}
          </div>
          <p className="team-hint">Click any colour dot to reassign. Click ✕ to remove a member.</p>
        </div>
      )}

      {/* Stats */}
      <div className="stats-row">
        {[['Total',stats.total,'#c9a84c'],['Done',stats.done,'#7debb0'],['MVP',stats.mvp,'#f0d080']].map(([l,n,c])=>(
          <div key={l} className="stat-box">
            <div className="stat-num" style={{color:c}}>{n}</div>
            <div className="stat-label">{l}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filters">
        {FILTERS.map(f=>(
          <button key={f.key} onClick={()=>setFilter(f.key)} className={`f-btn${filter===f.key?' f-active':''}`}>{f.label}</button>
        ))}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="form-card">
          <h3 className="form-title">{editId?'Edit Task':'New Task'}</h3>
          <div className="form-grid">
            <input value={form.name}        onChange={e=>setForm({...form,name:e.target.value})}        placeholder="Task name *"                  className="inp"/>
            <input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Description"                  className="inp"/>
            <input value={form.tech}        onChange={e=>setForm({...form,tech:e.target.value})}        placeholder="Tech stack (comma separated)" className="inp"/>
            {/* Assign to — shows member names as options */}
            <select value={form.assigned_to} onChange={e=>setForm({...form,assigned_to:e.target.value})} className="sel" style={{width:'100%'}}>
              <option value="">Assign to…</option>
              {members.map(m=><option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
            <div className="sel-row">
              <select value={form.layer}    onChange={e=>setForm({...form,layer:e.target.value})}    className="sel">
                {Object.entries(LAYER).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
              <select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})} className="sel">
                {Object.entries(PRI).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
              <select value={form.status}   onChange={e=>setForm({...form,status:e.target.value})}   className="sel">
                {Object.entries(STATUS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button onClick={saveTask} className="save-btn">{editId?'Update':'Add Task'}</button>
            <button onClick={()=>{setShowForm(false);setForm(EMPTY);setEditId(null)}} className="cancel-btn">Cancel</button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="list">
        {loading && <div className="empty">Loading…</div>}
        {!loading && filtered.length===0 && <div className="empty">No tasks yet — add one! 🙏</div>}
        {filtered.map(t=>{
          const sc=C[t.status]; const lc=C[t.layer]; const pc=C[t.priority]
          const assigneeColor = colorOf(t.assigned_to)
          const creatorColor  = colorOf(t.created_by)
          return (
            <div key={t.id} className={`card${t.status==='done'?' card-done':''}`}>
              <div className="card-top">
                <div className="card-text">
                  <div className="task-name">{t.name}</div>
                  {t.description && <div className="task-desc">{t.description}</div>}
                </div>
                <div className="card-actions">
                  <button className="badge status-btn" onClick={()=>cycleStatus(t)} title="Click to advance"
                    style={{background:sc?.bg,color:sc?.color,border:`1px solid ${sc?.border}`}}>
                    {STATUS[t.status]}
                  </button>
                  <button className="icon-btn" onClick={()=>openEdit(t)}>✎</button>
                  <button className="icon-btn danger" onClick={()=>deleteTask(t.id)}>✕</button>
                </div>
              </div>
              <div className="card-meta">
                <span className="badge" style={{background:lc?.bg,color:lc?.color,border:`1px solid ${lc?.border}`}}>{LAYER[t.layer]}</span>
                <span className="badge" style={{background:pc?.bg,color:pc?.color,border:`1px solid ${pc?.border}`}}>{PRI[t.priority]}</span>
                {(t.tech||[]).map((tech,i)=><span key={i} className="tech-tag">{tech}</span>)}
                {t.assigned_to && (
                  <span className="assigned" style={{color:assigneeColor}}>
                    <span className="dot" style={{background:assigneeColor,width:6,height:6}}/>
                    {t.assigned_to}
                  </span>
                )}
                {t.created_by && (
                  <span className="created-by" style={{color:creatorColor+'99'}}>by {t.created_by}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Styles() {
  return <style global jsx>{`
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{background:#08050a;font-family:Georgia,serif;color:rgba(240,208,128,.85);-webkit-font-smoothing:antialiased}
    .root{min-height:100vh;padding-bottom:80px}

    /* Join / PIN */
    .join-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px}
    .join-input{width:100%;max-width:280px;padding:13px 16px;border-radius:12px;border:1px solid rgba(201,168,76,.25);background:rgba(0,0,0,.4);color:rgba(240,208,128,.9);font-size:18px;outline:none;text-align:center;margin-bottom:10px;font-family:Georgia,serif;letter-spacing:.12em}
    .join-input.inp-err{border-color:rgba(255,80,80,.5);animation:shake .3s ease}
    .pin-err{color:rgba(255,80,80,.7);font-size:12px;margin-bottom:10px;font-style:italic}
    .join-btn{padding:12px 34px;border-radius:30px;border:1px solid rgba(201,168,76,.4);background:rgba(201,168,76,.1);color:#c9a84c;cursor:pointer;font-size:14px;letter-spacing:.08em;margin-top:4px;transition:background .2s}
    .join-btn:hover{background:rgba(201,168,76,.2)}

    /* Color picker */
    .color-pick-label{font-size:11px;color:rgba(255,255,255,.3);letter-spacing:.08em;text-transform:uppercase;margin:18px 0 10px;text-align:center}
    .color-grid{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:22px;max-width:240px}
    .color-dot{width:24px;height:24px;border-radius:50%;cursor:pointer;transition:transform .15s}
    .color-dot:hover{transform:scale(1.2)}
    .color-dot.selected{transform:scale(1.25)}
    .color-dot.sm{width:16px;height:16px}
    .color-dot.sm.selected{transform:scale(1.2)}

    @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}

    /* Typography */
    .om{font-size:20px;color:rgba(201,168,76,.35);text-align:center;margin-bottom:4px;padding-top:28px}
    .h1{font-weight:400;color:#c9a84c;text-align:center;letter-spacing:.08em;margin:6px 0 14px;font-size:clamp(16px,3vw,22px)}
    .sub{text-align:center;font-size:13px;color:rgba(240,208,128,.35);font-style:italic;margin-bottom:24px}
    .dot{display:inline-block;border-radius:50%;width:8px;height:8px;flex-shrink:0}

    /* Toast */
    .toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(12,9,5,.97);border:1px solid rgba(201,168,76,.35);color:#c9a84c;padding:10px 22px;border-radius:30px;font-size:12px;font-family:monospace;z-index:999;white-space:nowrap}

    /* Header */
    .header{padding:0 16px 14px}
    .header-row{display:flex;justify-content:space-between;align-items:center;max-width:860px;margin:0 auto;gap:10px}
    .name-badge{display:flex;align-items:center;gap:7px;font-size:13px;font-style:italic;font-weight:400}
    .header-btns{display:flex;gap:8px;flex-shrink:0}
    .add-btn{padding:9px 16px;border-radius:30px;border:1px solid rgba(201,168,76,.3);background:rgba(201,168,76,.1);color:#c9a84c;cursor:pointer;font-size:12px;white-space:nowrap;transition:background .2s}
    .add-btn:hover{background:rgba(201,168,76,.18)}
    .team-btn{padding:9px 16px;border-radius:30px;border:1px solid rgba(126,200,227,.2);background:rgba(126,200,227,.06);color:#7ec8e3;cursor:pointer;font-size:12px;white-space:nowrap;transition:background .2s}
    .team-btn:hover{background:rgba(126,200,227,.12)}

    /* Team panel */
    .team-panel{max-width:860px;margin:0 auto 16px;padding:20px 16px;background:rgba(126,200,227,.03);border:1px solid rgba(126,200,227,.12);border-radius:14px}
    .member-list{display:flex;flex-direction:column;gap:12px;margin-bottom:12px}
    .member-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05)}
    .member-row:last-child{border-bottom:none}
    .member-name{font-size:14px;font-weight:400;min-width:80px}
    .you-tag{font-size:10px;color:rgba(255,255,255,.25);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:2px 7px;font-family:monospace}
    .member-colors{display:flex;flex-wrap:wrap;gap:6px;flex:1}
    .team-hint{font-size:11px;color:rgba(255,255,255,.2);font-style:italic}

    /* Stats */
    .stats-row{display:flex;gap:10px;justify-content:center;padding:0 16px 16px;flex-wrap:wrap}
    .stat-box{padding:10px 14px;border-radius:12px;border:1px solid rgba(201,168,76,.1);background:rgba(201,168,76,.03);text-align:center;flex:1;max-width:130px;min-width:70px}
    .stat-num{font-size:22px}
    .stat-label{font-size:10px;letter-spacing:.1em;color:rgba(201,168,76,.35);text-transform:uppercase;margin-top:3px}

    /* Filters */
    .filters{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:0 16px 16px;max-width:860px;margin:0 auto}
    .f-btn{padding:6px 12px;border-radius:20px;border:1px solid rgba(201,168,76,.12);background:transparent;color:rgba(240,208,128,.3);cursor:pointer;font-size:11px;letter-spacing:.03em;font-family:Georgia,serif;white-space:nowrap;transition:all .18s}
    .f-btn:hover{color:rgba(240,208,128,.6);border-color:rgba(201,168,76,.25)}
    .f-active{background:rgba(201,168,76,.1)!important;border-color:#c9a84c!important;color:#c9a84c!important}

    /* Form */
    .form-card{max-width:860px;margin:0 auto 16px;padding:20px 16px;background:rgba(255,255,255,.03);border:1px solid rgba(201,168,76,.14);border-radius:14px}
    .form-title{font-size:14px;color:#c9a84c;margin-bottom:14px;font-weight:400;letter-spacing:.06em}
    .form-grid{display:flex;flex-direction:column;gap:9px}
    .inp{width:100%;padding:10px 13px;border-radius:8px;border:1px solid rgba(201,168,76,.14);background:rgba(0,0,0,.35);color:rgba(240,208,128,.85);font-size:14px;outline:none;font-family:Georgia,serif}
    .inp::placeholder{color:rgba(255,255,255,.2)}
    .sel-row{display:flex;gap:8px;flex-wrap:wrap}
    .sel{flex:1;min-width:100px;padding:9px 10px;border-radius:8px;border:1px solid rgba(201,168,76,.14);background:#0d0b10;color:#f0d080;font-size:13px;cursor:pointer;outline:none}
    .form-actions{display:flex;gap:8px;margin-top:13px;flex-wrap:wrap}
    .save-btn{padding:10px 24px;border-radius:30px;border:1px solid rgba(39,174,96,.3);background:rgba(39,174,96,.12);color:#7debb0;cursor:pointer;font-size:13px}
    .cancel-btn{padding:10px 16px;border-radius:30px;border:1px solid rgba(255,80,80,.15);background:transparent;color:rgba(255,80,80,.45);cursor:pointer;font-size:13px}

    /* Cards */
    .list{max-width:860px;margin:0 auto;padding:0 16px;display:flex;flex-direction:column;gap:9px}
    .empty{text-align:center;padding:48px 20px;color:rgba(255,255,255,.2);font-style:italic}
    .card{padding:14px;border-radius:13px;border:1px solid rgba(201,168,76,.1);background:rgba(255,255,255,.022);transition:border-color .2s}
    .card:hover{border-color:rgba(201,168,76,.22)}
    .card-done{opacity:.5}
    .card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px}
    .card-text{flex:1;min-width:0}
    .task-name{font-size:14px;color:rgba(240,208,128,.92);margin-bottom:3px;word-break:break-word}
    .task-desc{font-size:12px;color:rgba(255,255,255,.27);font-style:italic;line-height:1.45;word-break:break-word}
    .card-actions{display:flex;gap:4px;align-items:center;flex-shrink:0}
    .card-meta{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
    .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;letter-spacing:.04em;font-family:monospace;white-space:nowrap}
    .status-btn{cursor:pointer}
    .tech-tag{padding:2px 7px;border-radius:5px;font-family:monospace;font-size:10px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.38);border:1px solid rgba(255,255,255,.08);white-space:nowrap}
    .assigned{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-style:italic}
    .created-by{font-size:10px;font-style:italic;margin-left:auto}
    .icon-btn{background:none;border:none;color:rgba(201,168,76,.4);cursor:pointer;font-size:15px;padding:4px 6px;border-radius:6px;transition:background .15s}
    .icon-btn:hover{background:rgba(255,255,255,.07);color:rgba(201,168,76,.8)}
    .icon-btn.danger{color:rgba(255,80,80,.4)}
    .icon-btn.danger:hover{color:rgba(255,80,80,.8)}

    /* Desktop */
    @media(min-width:640px){
      .header{padding:0 28px 16px}
      .filters{padding:0 28px 20px}
      .list{padding:0 28px;gap:11px}
      .form-card,.team-panel{padding:24px 28px}
      .stats-row{padding:0 28px 20px}
      .card{padding:18px 20px}
      .task-name{font-size:15px}
      .sel-row{flex-wrap:nowrap}
      .stat-box{max-width:110px}
      .add-btn,.team-btn{font-size:13px}
    }
  `}</style>
}