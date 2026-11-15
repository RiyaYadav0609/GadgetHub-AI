
import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell,
  BrainCircuit, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  CircleDollarSign, CreditCard, Download, Eye, FileText, Fingerprint,
  Gauge, LayoutDashboard, Menu, Network, RefreshCw, Search, Settings,
  Shield, ShieldAlert, ShieldCheck, Sparkles, Target, Users, X, Zap,
  Clock3, SlidersHorizontal
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis,
  YAxis, PieChart, Pie, Cell
} from 'recharts'
import { api } from './services/api'

type Tab =
  | 'Overview' | 'Transactions' | 'Fraud Detection' | 'Fraud Network'
  | 'Attack Simulator' | 'Alerts' | 'Investigations' | 'Chargebacks'
  | 'Analytics' | 'Model Monitoring' | 'Reports' | 'Audit Logs' | 'Settings'

type Transaction = {
  id: number
  reference: string
  customer: string
  amount: number
  product: string
  city: string
  risk_score: number
  decision: string
  status: string
  new_address?: boolean
  attempts_10m?: number
  account_age_days?: number
  device_id?: string
  created_at?: string
}

const nav = [
  { section: 'COMMAND', items: [['Overview', LayoutDashboard], ['Transactions', CreditCard], ['Fraud Detection', ShieldCheck], ['Fraud Network', Network], ['Attack Simulator', Zap]] },
  { section: 'OPERATIONS', items: [['Alerts', Bell], ['Investigations', Eye], ['Chargebacks', FileText]] },
  { section: 'INTELLIGENCE', items: [['Analytics', Activity], ['Model Monitoring', BrainCircuit], ['Reports', Target]] },
  { section: 'ADMINISTRATION', items: [['Audit Logs', Clock3], ['Settings', Settings]] }
] as const

const colors = ['#d946ef', '#a855f7', '#f59e0b', '#ef4444']

const money = (n: number) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })

const dateText = (value?: string) =>
  value
    ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not available'

const initialSim = {
  customer: 'Test Customer',
  product: 'Gaming Laptop',
  city: 'Delhi',
  amount: '28999',
  new_address: true,
  attempts_10m: '12',
  account_age_days: '4',
  device_id: 'device-new-91',
  device_age_days: '2',
  ip_velocity_1h: '9',
  failed_logins_24h: '3',
  email_age_days: '2',
  prior_chargebacks: '0',
  device_shared_accounts: '4',
  card_bin_velocity: '8',
  shipping_billing_mismatch: true,
  country_mismatch: false
}

function App() {
  const [tab, setTab] = useState<Tab>('Overview')
  const [collapsed, setCollapsed] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [dashboard, setDashboard] = useState<any>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [disputes, setDisputes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scoring, setScoring] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const [decisionFilter, setDecisionFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [selectedAlert, setSelectedAlert] = useState<any>(null)
  const [sim, setSim] = useState(initialSim)
  const [result, setResult] = useState<any>(null)

  const refresh = async (showLoader = true) => {
    if (showLoader) setLoading(true)
    setError('')

    try {
      const [d, t, a, c] = await Promise.all([
        api.dashboard(),
        api.transactions(),
        api.alerts(),
        api.chargebacks()
      ])

      setDashboard(d)
      setTransactions(Array.isArray(t) ? t : [])
      setAlerts(Array.isArray(a) ? a : [])
      setDisputes(Array.isArray(c) ? c : [])
    } catch {
      setError('Backend is not reachable. Start the FastAPI server on port 8000.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [query, decisionFilter, statusFilter])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    return transactions.filter(t => {
      const matchesQuery = !q || [
        t.reference, t.customer, t.product, t.city,
        t.decision, t.status, t.device_id
      ].some(v => String(v ?? '').toLowerCase().includes(q))

      const matchesDecision =
        decisionFilter === 'ALL' || t.decision === decisionFilter

      const matchesStatus =
        statusFilter === 'ALL' || t.status === statusFilter

      return matchesQuery && matchesDecision && matchesStatus
    })
  }, [transactions, query, decisionFilter, statusFilter])

  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)

  const pageRows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const score = async () => {
    if (!sim.customer.trim() || !sim.product.trim() || !sim.city.trim()) {
      notify('Please enter customer, product and city.')
      return
    }

    if (Number(sim.amount) <= 0) {
      notify('Enter a valid transaction amount.')
      return
    }

    setScoring(true)
    setResult(null)

    try {
      const response = await api.score({
        ...sim,
        customer: sim.customer.trim(),
        product: sim.product.trim(),
        city: sim.city.trim(),
        amount: Number(sim.amount),
        attempts_10m: Number(sim.attempts_10m),
        account_age_days: Number(sim.account_age_days),
        device_age_days: Number(sim.device_age_days),
        ip_velocity_1h: Number(sim.ip_velocity_1h),
        failed_logins_24h: Number(sim.failed_logins_24h),
        email_age_days: Number(sim.email_age_days),
        prior_chargebacks: Number(sim.prior_chargebacks),
        device_shared_accounts: Number(sim.device_shared_accounts),
        card_bin_velocity: Number(sim.card_bin_velocity)
      })

      setResult(response)
      await refresh(false)
      notify('Risk assessment completed and transaction saved.')
    } catch (e: any) {
      notify(e?.message || 'Unable to reach risk engine.')
    } finally {
      setScoring(false)
    }
  }

  const resolve = async (id: number) => {
    try {
      await api.resolveAlert(id)
      await refresh(false)
      setSelectedAlert(null)
      notify('Alert marked as resolved.')
    } catch {
      notify('Could not update alert.')
    }
  }

  const exportCSV = () => {
    const headers = [
      'Reference', 'Customer', 'Product', 'City',
      'Amount', 'Risk Score', 'Decision', 'Status', 'Created At'
    ]

    const quote = (v: any) =>
      `"${String(v ?? '').replace(/"/g, '""')}"`

    const rows = filtered.map(t => [
      t.reference, t.customer, t.product, t.city,
      t.amount, t.risk_score, t.decision, t.status, t.created_at
    ])

    const csv = '\uFEFF' +
      [headers, ...rows]
        .map(row => row.map(quote).join(','))
        .join('\r\n')

    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    )

    const link = document.createElement('a')
    link.href = url
    link.download = 'gadgethub-transactions.csv'
    link.click()

    URL.revokeObjectURL(url)
  }

  const kpis = dashboard ? [
    {
      label: 'Payment volume',
      value: money(dashboard.payment_volume),
      icon: CircleDollarSign,
      color: 'pink'
    },
    {
      label: 'Transactions screened',
      value: Number(dashboard.total_transactions || 0).toLocaleString('en-IN'),
      icon: CreditCard,
      color: 'violet'
    },
    {
      label: 'Flagged transactions',
      value: Number(dashboard.flagged_transactions || 0).toLocaleString('en-IN'),
      icon: ShieldAlert,
      color: 'amber'
    },
    {
      label: 'Fraud prevented estimate',
      value: money(dashboard.estimated_fraud_prevented),
      icon: ShieldCheck,
      color: 'green'
    }
  ] : []

  return (
    <div className="app-shell">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobile ? 'mobile-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Shield size={21} /><span /></div>
          {!collapsed && <div><b>GADGETHUB<span>.AI</span></b><small>RISK INTELLIGENCE</small></div>}
          <button className="mobile-close" onClick={() => setMobile(false)}><X size={18} /></button>
        </div>

        <div className="workspace">
          <div className="workspace-icon">G</div>
          {!collapsed && <div><b>GadgetHub Commerce</b><small>Enterprise workspace</small></div>}
          <ChevronDown size={14} />
        </div>

        <nav>
          {nav.map(group => (
            <div className="nav-group" key={group.section}>
              <div className="nav-label">{!collapsed && group.section}</div>
              {group.items.map(([name, Icon]) => (
                <button
                  key={name}
                  className={`nav-item ${tab === name ? 'active' : ''}`}
                  onClick={() => {
                    setTab(name as Tab)
                    setMobile(false)
                  }}
                  title={name}
                >
                  <Icon size={17} />
                  {!collapsed && <span>{name}</span>}
                  {name === 'Alerts' &&
                    alerts.filter(a => a.status === 'OPEN').length > 0 &&
                    !collapsed &&
                    <em>{alerts.filter(a => a.status === 'OPEN').length}</em>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span className="live-dot" />
            {!collapsed && <>
              <span>API connection status</span>
              <small>LOCAL DEMO ENVIRONMENT</small>
            </>}
          </div>

          <button className="profile">
            <div className="avatar">RA</div>
            {!collapsed && <>
              <div><b>Risk Analyst</b><small>Security operations</small></div>
              <ChevronDown size={14} />
            </>}
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="top-left">
            <button className="icon-btn menu-btn" onClick={() => setMobile(true)}>
              <Menu size={19} />
            </button>
            <div className="crumb">Workspace <span>/</span> <b>{tab}</b></div>
          </div>

          <div className="top-actions">
            <div className="env-pill"><span /> LOCAL DEMO</div>
            <button className="icon-btn" onClick={() => refresh()} title="Refresh data">
              <RefreshCw size={17} />
            </button>
            <button className="icon-btn notification" onClick={() => setTab('Alerts')}>
              <Bell size={18} /><i />
            </button>
            <div className="top-avatar">RA</div>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" /> FRAUD & RISK OPERATIONS
              </div>
              <h1>{tab === 'Overview' ? 'Risk command center' : tab}</h1>
              <p>
                {tab === 'Overview'
                  ? 'Monitor payment activity, risk decisions and fraud operations.'
                  : 'Review operational data and manage payment risk.'}
              </p>
            </div>

            <div className="heading-actions">
              <div className="date-chip">
                <Clock3 size={14} />
                {new Date().toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric'
                })}
              </div>
              <button className="btn btn-secondary" onClick={() => refresh()}>
                <RefreshCw size={15} /> Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="error-banner">
              <AlertTriangle size={17} />{error}
              <button onClick={() => refresh()}>Retry</button>
            </div>
          )}

          {loading && !dashboard && (
            <div className="loading">
              <div className="spinner" />Connecting to risk intelligence engine…
            </div>
          )}

          {tab === 'Overview' && dashboard && (
            <Overview
              dashboard={dashboard}
              kpis={kpis}
              alerts={alerts}
              transactions={transactions}
              setTab={setTab}
              onSelect={setSelectedTransaction}
            />
          )}

          {tab === 'Transactions' && (
            <section className="panel">
              <PanelTitle
                title="Transaction intelligence"
                sub="Search, filter and inspect every transaction returned by the API"
                action={
                  <button className="btn btn-secondary" onClick={exportCSV}>
                    <Download size={15} /> Export filtered CSV
                  </button>
                }
              />

              <div className="transaction-filters">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    placeholder="Search reference, customer, product, city, device…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                  />
                </div>

                <label className="filter-control">
                  <SlidersHorizontal size={14} />
                  <select value={decisionFilter} onChange={e => setDecisionFilter(e.target.value)}>
                    <option value="ALL">All decisions</option>
                    <option>APPROVE</option>
                    <option>CHALLENGE</option>
                    <option>REVIEW</option>
                    <option>DECLINE</option>
                  </select>
                </label>

                <label className="filter-control">
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="ALL">All statuses</option>
                    {[...new Set(transactions.map(t => t.status).filter(Boolean))].map(s => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="table-summary">
                <span><b>{filtered.length}</b> matching transactions</span>
                <span>Page {currentPage} of {totalPages} · {pageSize} per page</span>
              </div>

              <TransactionTable rows={pageRows} onSelect={setSelectedTransaction} />
              <Pagination page={currentPage} totalPages={totalPages} setPage={setPage} />
            </section>
          )}

          {tab === 'Fraud Detection' && (
            <FraudPage transactions={transactions} onSelect={setSelectedTransaction} />
          )}

          {tab === 'Attack Simulator' && (
            <section className="sim-layout">
              <div className="panel">
                <PanelTitle
                  title="Payment risk simulator"
                  sub="Enter customer and transaction details to assess risk"
                />

                <div className="form-section-label">CUSTOMER & ORDER INFORMATION</div>
                <div className="form-grid">
                  <Field label="Customer name">
                    <input value={sim.customer} onChange={e => setSim({ ...sim, customer: e.target.value })} placeholder="Enter customer name" />
                  </Field>
                  <Field label="Product">
                    <input value={sim.product} onChange={e => setSim({ ...sim, product: e.target.value })} placeholder="e.g. Gaming Laptop" />
                  </Field>
                  <Field label="City">
                    <input value={sim.city} onChange={e => setSim({ ...sim, city: e.target.value })} placeholder="e.g. Delhi" />
                  </Field>
                  <Field label="Transaction amount (₹)">
                    <input type="number" min="1" value={sim.amount} onChange={e => setSim({ ...sim, amount: e.target.value })} />
                  </Field>
                </div>

                <div className="form-section-label">ACCOUNT & DEVICE SIGNALS</div>
                <div className="form-grid">
                  <Field label="Attempts in last 10 minutes">
                    <input type="number" min="1" value={sim.attempts_10m} onChange={e => setSim({ ...sim, attempts_10m: e.target.value })} />
                  </Field>
                  <Field label="Account age (days)">
                    <input type="number" min="0" value={sim.account_age_days} onChange={e => setSim({ ...sim, account_age_days: e.target.value })} />
                  </Field>
                  <Field label="Device fingerprint">
                    <input value={sim.device_id} onChange={e => setSim({ ...sim, device_id: e.target.value })} />
                  </Field>
                  <Field label="Device age (days)">
                    <input type="number" min="0" value={sim.device_age_days} onChange={e => setSim({ ...sim, device_age_days: e.target.value })} />
                  </Field>
                  <Field label="IP transactions / hour">
                    <input type="number" min="0" value={sim.ip_velocity_1h} onChange={e => setSim({ ...sim, ip_velocity_1h: e.target.value })} />
                  </Field>
                  <Field label="Failed logins / 24h">
                    <input type="number" min="0" value={sim.failed_logins_24h} onChange={e => setSim({ ...sim, failed_logins_24h: e.target.value })} />
                  </Field>
                  <Field label="Email age (days)">
                    <input type="number" min="0" value={sim.email_age_days} onChange={e => setSim({ ...sim, email_age_days: e.target.value })} />
                  </Field>
                  <Field label="Prior chargebacks">
                    <input type="number" min="0" value={sim.prior_chargebacks} onChange={e => setSim({ ...sim, prior_chargebacks: e.target.value })} />
                  </Field>
                  <Field label="Accounts on device">
                    <input type="number" min="1" value={sim.device_shared_accounts} onChange={e => setSim({ ...sim, device_shared_accounts: e.target.value })} />
                  </Field>
                  <Field label="Card BIN attempts / hour">
                    <input type="number" min="0" value={sim.card_bin_velocity} onChange={e => setSim({ ...sim, card_bin_velocity: e.target.value })} />
                  </Field>
                </div>

                <div className="form-section-label">RISK INDICATORS</div>
                <Toggle
                  label="New delivery address"
                  description="Address recently added to customer profile"
                  checked={sim.new_address}
                  onChange={v => setSim({ ...sim, new_address: v })}
                />
                <Toggle
                  label="Shipping and billing mismatch"
                  description="Billing and delivery details do not match"
                  checked={sim.shipping_billing_mismatch}
                  onChange={v => setSim({ ...sim, shipping_billing_mismatch: v })}
                />
                <Toggle
                  label="Country mismatch"
                  description="Transaction country differs from account history"
                  checked={sim.country_mismatch}
                  onChange={v => setSim({ ...sim, country_mismatch: v })}
                />

                <button className="btn btn-primary full-btn" onClick={score} disabled={scoring}>
                  <Sparkles size={16} />
                  {scoring ? 'Assessing transaction…' : 'Run risk assessment'}
                </button>
              </div>

              <div className="panel result-panel">
                <PanelTitle title="Decision output" sub="Risk score and model evidence" />

                {result ? <>
                  <div className="result-reference">
                    TRANSACTION REFERENCE
                    <b>{result.reference || 'Saved transaction'}</b>
                  </div>

                  <div
                    className="score-circle"
                    style={{ '--score': `${Number(result.risk_score || 0) * 3.6}deg` } as any}
                  >
                    <div><strong>{result.risk_score}</strong><small>/ 100</small></div>
                  </div>

                  <div className={`decision-chip ${String(result.decision).toLowerCase()}`}>
                    {result.decision}
                  </div>

                  <div className="result-meta">
                    <span>Customer</span><b>{result.customer || sim.customer}</b>
                    <span>Amount</span><b>{money(result.amount || Number(sim.amount))}</b>
                    <span>Status</span><b>{result.status || '—'}</b>
                  </div>

                  {result.ml && (
                    <div className="evidence-note">
                      <BrainCircuit size={16} />
                      <div>
                        <b>ML fraud probability: {(result.ml.fraud_probability * 100).toFixed(1)}%</b>
                        <p>
                          Random Forest {(result.ml.random_forest_probability * 100).toFixed(1)}%
                          · XGBoost {(result.ml.xgboost_probability * 100).toFixed(1)}%
                          · Anomaly {(result.ml.anomaly_score * 100).toFixed(1)}%
                        </p>
                        <p>ML is advisory; the final decision shown is based on the backend risk rules.</p>
                      </div>
                    </div>
                  )}

                  <h4>Signals detected</h4>
                  <ul className="signal-list">
                    {(result.reasons || []).map((r: string, i: number) => (
                      <li key={i}><AlertTriangle size={14} />{r}</li>
                    ))}
                  </ul>

                  <p className="muted tiny">Scoring mode: {result.scoring_mode || 'Backend risk engine'}</p>

                  <button className="btn btn-secondary full-btn" onClick={() => setTab('Transactions')}>
                    View saved transactions <ChevronRight size={15} />
                  </button>
                </> : (
                  <div className="empty-result">
                    <div className="empty-icon"><Gauge size={28} /></div>
                    <b>Awaiting assessment</b>
                    <p>Enter customer and payment details, then run the risk engine to see its decision and explanation.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {tab === 'Alerts' && (
            <section className="panel">
              <PanelTitle title="Fraud alert queue" sub="Select an alert to inspect its details and resolution status" />

              <div className="alert-list">
                {alerts.map(a => (
                  <div className="alert-row alert-clickable" key={a.id} onClick={() => setSelectedAlert(a)}>
                    <div className={`severity-icon ${(a.severity || 'medium').toLowerCase()}`}>
                      <AlertTriangle size={18} />
                    </div>
                    <div className="alert-copy">
                      <b>{a.title}</b>
                      <p>{a.description}</p>
                      <small>{a.category} · Alert #{a.id}</small>
                    </div>
                    <span className={`severity ${(a.severity || 'medium').toLowerCase()}`}>
                      {a.severity}
                    </span>
                    {a.status === 'OPEN'
                      ? <button className="btn btn-secondary small-btn" onClick={e => { e.stopPropagation(); resolve(a.id) }}>Resolve</button>
                      : <span className="resolved"><CheckCircle2 size={14} /> Resolved</span>}
                  </div>
                ))}

                {alerts.length === 0 && (
                  <div className="no-data">No alerts are currently stored in the database.</div>
                )}
              </div>
            </section>
          )}

          {tab === 'Chargebacks' && (
            <section className="panel">
              <PanelTitle title="Dispute & chargeback desk" sub="Review stored cases, deadlines and evidence readiness" />

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>CASE ID</th><th>TRANSACTION</th><th>REASON</th>
                      <th>AMOUNT</th><th>RESPONSE DUE</th><th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disputes.map(d => (
                      <tr key={d.id}>
                        <td className="mono">{d.case_ref}</td>
                        <td>{d.transaction_ref}</td>
                        <td>{d.reason}</td>
                        <td className="amount">{money(d.amount)}</td>
                        <td>{d.due_date}</td>
                        <td>
                          <span className="status-badge warning">
                            {String(d.status).replaceAll('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {disputes.length === 0 && <div className="no-data">No chargeback cases returned by the API.</div>}
              </div>

              <div className="evidence-note">
                <ShieldCheck size={18} />
                <div>
                  <b>Evidence preservation checklist</b>
                  <p>
                    Retain authorization result, AVS/CVV response (never raw CVV),
                    3DS outcome, device/IP signals, order details, delivery proof,
                    customer communications and timestamped audit trail.
                  </p>
                </div>
              </div>
            </section>
          )}

          {tab === 'Analytics' && dashboard && (
            <Overview dashboard={dashboard} kpis={kpis} alerts={alerts} transactions={transactions} setTab={setTab} onSelect={setSelectedTransaction} />
          )}

          {tab === 'Investigations' && (
            <InvestigationPage transactions={transactions} onSelect={setSelectedTransaction} />
          )}

          {tab === 'Model Monitoring' && <ModelMonitoring />}

          {tab === 'Reports' && (
            <ReportsPage dashboard={dashboard} transactions={transactions} />
          )}

          {tab === 'Fraud Network' && <NetworkPage />}

          {tab === 'Audit Logs' && <AuditPage transactions={transactions} alerts={alerts} />}

          {tab === 'Settings' && <SettingsPage />}
        </div>

        <footer className="footer">
          <span>GADGETHUB.AI <b>RISK INTELLIGENCE</b></span>
          <span>Local application · API-connected demo build</span>
        </footer>
      </main>

      {mobile && <div className="scrim" onClick={() => setMobile(false)} />}

      {selectedTransaction && (
        <TransactionDetail
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}

      {selectedAlert && (
        <AlertDetail
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onResolve={resolve}
        />
      )}

      {toast && <div className="toast"><CheckCircle2 size={16} />{toast}</div>}
    </div>
  )
}

function PanelTitle({ title, sub, action }: { title: string; sub: string; action?: any }) {
  return (
    <div className="panel-title">
      <div><h3>{title}</h3><p>{sub}</p></div>
      {action}
    </div>
  )
}

function Overview({ dashboard, kpis, alerts, transactions, setTab, onSelect }: any) {
  const recent = transactions.slice(0, 5)
  const distribution = dashboard.risk_distribution || []

  return <>
    <div className="kpi-grid">
      {kpis.map((k: any) => (
        <div className="kpi-card" key={k.label}>
          <div className="kpi-top">
            <span>{k.label}</span>
            <div className={`kpi-icon ${k.color}`}><k.icon size={18} /></div>
          </div>
          <strong>{k.value}</strong>
          <div className="kpi-foot"><span>Database summary</span></div>
        </div>
      ))}
    </div>

    <div className="insight-banner">
      <div className="insight-icon"><Sparkles size={20} /></div>
      <div>
        <b>Risk operations briefing</b>
        <p>Review repeated micro-payment attempts, new account activity, unusual devices and high-risk address changes. Validate each signal before taking action.</p>
      </div>
      <span className="briefing-tag">RISK POLICY</span>
    </div>

    <div className="chart-grid">
      <div className="panel chart-panel">
        <PanelTitle title="Transaction activity" sub="Daily transaction counts returned by the backend" />
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dashboard.weekly_trend || []}>
              <defs>
                <linearGradient id="pinkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e879f9" stopOpacity={.24} />
                  <stop offset="95%" stopColor="#e879f9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#292630" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="day" stroke="#77717f" tickLine={false} axisLine={false} />
              <YAxis stroke="#77717f" tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#17151d', border: '1px solid #393342', borderRadius: 10, color: '#fff' }} />
              <Area type="monotone" dataKey="transactions" name="Transactions" stroke="#e879f9" fill="url(#pinkFill)" strokeWidth={2.5} />
              <Area type="monotone" dataKey="fraud" name="Flagged" stroke="#a78bfa" fill="transparent" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel chart-panel">
        <PanelTitle title="Decision distribution" sub="Stored transaction decisions" />
        <div className="donut-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={63} outerRadius={88} paddingAngle={4} stroke="none">
                {distribution.map((_: any, i: number) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#17151d', border: '1px solid #393342', borderRadius: 10 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center">
            <b>{dashboard.total_transactions ?? 0}</b>
            <small>TRANSACTIONS</small>
          </div>
        </div>
        <div className="legend-list">
          {distribution.map((r: any, i: number) => (
            <div key={r.name}>
              <span><i style={{ background: colors[i % colors.length] }} />{r.name}</span>
              <b>{r.value}</b>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="bottom-grid">
      <div className="panel">
        <PanelTitle
          title="Recent transactions"
          sub="Select a row to inspect its complete details"
          action={<button className="text-btn" onClick={() => setTab('Transactions')}>View all →</button>}
        />
        <TransactionTable rows={recent} onSelect={onSelect} />
      </div>

      <div className="panel">
        <PanelTitle
          title="Priority alerts"
          sub="Latest stored alerts"
          action={<button className="text-btn" onClick={() => setTab('Alerts')}>All alerts →</button>}
        />
        <div className="mini-alerts">
          {alerts.slice(0, 4).map((a: any) => (
            <div className="mini-alert" key={a.id} onClick={() => setTab('Alerts')}>
              <span className={`mini-severity ${(a.severity || 'medium').toLowerCase()}`} />
              <div><b>{a.title}</b><small>{a.category} · {a.severity}</small></div>
              <ArrowDownRight size={15} />
            </div>
          ))}
          {alerts.length === 0 && <div className="no-data">No alerts available.</div>}
        </div>
      </div>
    </div>
  </>
}

function TransactionTable({ rows, onSelect }: { rows: Transaction[]; onSelect?: (t: Transaction) => void }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>REFERENCE</th><th>CUSTOMER</th><th>AMOUNT</th>
            <th>RISK SCORE</th><th>DECISION</th><th>STATUS</th><th>DETAIL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(t => (
            <tr
              key={t.id}
              className={onSelect ? 'clickable-row' : ''}
              onClick={() => onSelect?.(t)}
            >
              <td className="mono">{t.reference}</td>
              <td>{t.customer}</td>
              <td className="amount">{money(t.amount)}</td>
              <td>
                <div className="risk-cell">
                  <span className="risk-track">
                    <i style={{ width: `${Math.max(0, Math.min(100, t.risk_score || 0))}%` }} />
                  </span>
                  <b>{t.risk_score ?? 0}</b>
                </div>
              </td>
              <td><span className={`decision-chip tiny-chip ${(t.decision || 'approve').toLowerCase()}`}>{t.decision}</span></td>
              <td>
                <span className={`status-badge ${t.status === 'BLOCKED' ? 'danger' : t.status === 'CHALLENGE_REQUIRED' || t.status === 'UNDER_REVIEW' ? 'warning' : 'success'}`}>
                  {String(t.status || '').replaceAll('_', ' ')}
                </span>
              </td>
              <td>
                <button className="row-detail-btn" onClick={e => { e.stopPropagation(); onSelect?.(t) }}>
                  <Eye size={14} /> Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="no-data">No matching transactions found.</div>}
    </div>
  )
}

function Pagination({ page, totalPages, setPage }: any) {
  return (
    <div className="pagination">
      <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
        <ChevronLeft size={15} /> Previous
      </button>
      <span>Page <b>{page}</b> of <b>{totalPages}</b></span>
      <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
        Next <ChevronRight size={15} />
      </button>
    </div>
  )
}

function TransactionDetail({ transaction: t, onClose }: any) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <aside className="detail-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <span className="eyebrow">TRANSACTION RECORD</span>
            <h2>Transaction details</h2>
            <p className="mono">{t.reference}</p>
          </div>
          <button className="icon-btn" onClick={onClose}><X /></button>
        </div>

        <div className="drawer-score">
          <div><small>RISK SCORE</small><strong>{t.risk_score ?? 0}<span>/100</span></strong></div>
          <span className={`decision-chip ${(t.decision || 'approve').toLowerCase()}`}>{t.decision}</span>
        </div>

        <DetailSection title="Customer & order">
          <Detail label="Customer" value={t.customer} />
          <Detail label="Product" value={t.product} />
          <Detail label="City" value={t.city} />
          <Detail label="Amount" value={money(t.amount)} />
        </DetailSection>

        <DetailSection title="Risk assessment">
          <Detail label="Decision" value={t.decision} />
          <Detail label="Transaction status" value={String(t.status || '').replaceAll('_', ' ')} />
          <Detail label="New address" value={t.new_address == null ? 'Not recorded' : t.new_address ? 'Yes' : 'No'} />
          <Detail label="Attempts / 10 min" value={t.attempts_10m ?? 'Not recorded'} />
          <Detail label="Account age" value={t.account_age_days != null ? `${t.account_age_days} days` : 'Not recorded'} />
        </DetailSection>

        <DetailSection title="Device & timeline">
          <Detail label="Device fingerprint" value={t.device_id || 'Not recorded'} />
          <Detail label="Created at" value={dateText(t.created_at)} />
          <Detail label="Database record ID" value={t.id} />
        </DetailSection>

        <div className="evidence-note">
          <ShieldCheck size={18} />
          <div>
            <b>Record integrity</b>
            <p>These details are the fields currently returned by the transactions API. Additional signals are not shown unless the backend stores and returns them.</p>
          </div>
        </div>
      </aside>
    </div>
  )
}

function AlertDetail({ alert: a, onClose, onResolve }: any) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <aside className="detail-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <span className="eyebrow">SECURITY OPERATIONS</span>
            <h2>Alert details</h2>
            <p>Alert #{a.id}</p>
          </div>
          <button className="icon-btn" onClick={onClose}><X /></button>
        </div>

        <div className="alert-detail-title">
          <span className={`severity-icon ${(a.severity || 'medium').toLowerCase()}`}><AlertTriangle /></span>
          <div><b>{a.title}</b><small>{a.category} · {a.severity}</small></div>
        </div>

        <DetailSection title="Alert information">
          <Detail label="Alert ID" value={a.id} />
          <Detail label="Category" value={a.category} />
          <Detail label="Severity" value={a.severity} />
          <Detail label="Status" value={a.status} />
        </DetailSection>

        <DetailSection title="Description">
          <p className="drawer-description">{a.description}</p>
        </DetailSection>

        {a.status === 'OPEN' && (
          <button className="btn btn-primary full-btn" onClick={() => onResolve(a.id)}>
            Mark alert as resolved
          </button>
        )}
      </aside>
    </div>
  )
}

function DetailSection({ title, children }: any) {
  return <section className="detail-section"><h3>{title}</h3><div>{children}</div></section>
}

function Detail({ label, value }: any) {
  return <div className="detail-line"><span>{label}</span><b>{value ?? '—'}</b></div>
}

function Field({ label, children }: any) {
  return <label className="field"><span>{label}</span>{children}</label>
}

function Toggle({ label, description, checked, onChange }: any) {
  return (
    <label className="toggle-row">
      <span><b>{label}</b><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    </label>
  )
}

function ReportMetric({ title, value, note }: any) {
  return (
    <div className="report-metric">
      <small>{title}</small><b>{value}</b><p>{note}</p>
    </div>
  )
}

function FraudPage({ transactions, onSelect }: any) {
  const flagged = transactions.filter((t: Transaction) => t.risk_score >= 25)

  return <>
    <div className="kpi-grid compact-kpis">
      {[
        ['Card testing', 'Repeated micro-payment and velocity patterns', CreditCard],
        ['Account takeover', 'New account and device anomalies', Users],
        ['Address risk', 'New delivery address indicators', Target],
        ['Device intelligence', 'Shared or unfamiliar device signals', Fingerprint]
      ].map(([a, b, Icon]: any) => (
        <div className="kpi-card fraud-kpi" key={a}>
          <div className="fraud-icon"><Icon /></div><b>{a}</b><p>{b}</p>
        </div>
      ))}
    </div>

    <section className="panel">
      <PanelTitle title="Flagged transaction review" sub={`${flagged.length} transactions with a risk score of 25 or higher`} />
      <TransactionTable rows={flagged} onSelect={onSelect} />
    </section>
  </>
}

function InvestigationPage({ transactions, onSelect }: any) {
  const rows = transactions.filter(
    (t: Transaction) => ['REVIEW', 'CHALLENGE', 'DECLINE'].includes(t.decision)
  )

  return (
    <section className="panel">
      <PanelTitle title="Investigation workbench" sub="Transactions that may require analyst attention" />
      <div className="workflow-grid">
        {[
          ['01', 'Triage', 'Prioritize by risk, amount and customer impact'],
          ['02', 'Enrich', 'Review available device, address and velocity signals'],
          ['03', 'Decide', 'Approve, challenge, hold or decline with rationale'],
          ['04', 'Document', 'Preserve evidence and record analyst decisions']
        ].map(x => (
          <div className="workflow-card" key={x[0]}>
            <span>{x[0]}</span><b>{x[1]}</b><p>{x[2]}</p>
          </div>
        ))}
      </div>
      <div className="form-section-label">FLAGGED TRANSACTIONS</div>
      <TransactionTable rows={rows} onSelect={onSelect} />
    </section>
  )
}

function ModelMonitoring() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.mlStatus().then(setData).catch(() => setError('Could not load model status.'))
  }, [])

  const metrics = data?.metrics || {}
  const pct = (v: any) => v == null ? '—' : `${(Number(v) * 100).toFixed(1)}%`

  return (
    <section className="panel">
      <PanelTitle
        title="Operational ML model"
        sub="Status and evaluation information returned by the current backend"
        action={<span className={`status-badge ${data?.trained ? 'success' : 'warning'}`}>{data?.trained ? 'MODEL LOADED' : 'MODEL NOT LOADED'}</span>}
      />

      {error && <p className="muted">{error}</p>}

      {data?.trained ? <>
        <div className="monitor-grid">
          <div className="monitor-card"><span>Model version</span><b>{data.metadata?.model_version || '—'}</b><small>Backend model metadata</small></div>
          <div className="monitor-card"><span>Training records</span><b>{Number(data.metadata?.dataset_rows || 0).toLocaleString()}</b><small>As reported by model metadata</small></div>
          <div className="monitor-card"><span>Model type</span><b>RF + XGBoost</b><small>Ensemble model</small></div>
          <div className="monitor-card"><span>Training date</span><b>{data.metadata?.trained_at_utc ? new Date(data.metadata.trained_at_utc).toLocaleDateString() : '—'}</b><small>UTC metadata</small></div>
        </div>

        <div className="report-grid" style={{ marginTop: 18 }}>
          <ReportMetric title="Precision" value={pct(metrics.precision)} note="Predicted fraud cases that were fraud" />
          <ReportMetric title="Recall" value={pct(metrics.recall)} note="Fraud cases detected by the model" />
          <ReportMetric title="F1 score" value={pct(metrics.f1)} note="Harmonic mean of precision and recall" />
          <ReportMetric title="ROC-AUC" value={pct(metrics.roc_auc)} note="Ranking discrimination" />
          <ReportMetric title="PR-AUC" value={pct(metrics.pr_auc)} note="Precision-recall area" />
          <ReportMetric title="Accuracy" value={pct(metrics.accuracy)} note="Not sufficient alone for fraud evaluation" />
        </div>

        <div className="evidence-note">
          <BrainCircuit size={18} />
          <div>
            <b>Model governance note</b>
            <p>The current operational model was trained on the dataset described in its metadata. The separate IEEE-CIS benchmark is not automatically the same model and is not used for live transaction decisions unless explicitly integrated and validated.</p>
          </div>
        </div>
      </> : <div className="no-data">{data?.message || 'Loading model status…'}</div>}

      {data?.limitations?.length > 0 && <>
        <h3>Evaluation limitations</h3>
        <ul className="signal-list">
          {data.limitations.map((x: string, i: number) => <li key={i}>{x}</li>)}
        </ul>
      </>}
    </section>
  )
}

/* ======================================
   REPORT GENERATION CENTER
====================================== */

function ReportsPage({ dashboard, transactions = [] }: any) {
  const [mode, setMode] = useState<'ALL' | 'SINGLE'>('ALL')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const records: Transaction[] = Array.isArray(transactions) ? transactions : []

  const matching = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return records

    return records.filter(t =>
      [
        t.reference, t.customer, t.product, t.city,
        t.decision, t.status, t.device_id
      ].some(v => String(v ?? '').toLowerCase().includes(q))
    )
  }, [records, search])

  const selected =
    records.find(t => t.id === selectedId) ||
    matching[0] ||
    null

  const totalAmount = records.reduce(
    (sum, t) => sum + Number(t.amount || 0), 0
  )

  const count = (decision: string) =>
    records.filter(t => t.decision === decision).length

  const reportRows =
    mode === 'SINGLE'
      ? (selected ? [selected] : [])
      : records

  const escapeHTML = (value: any) =>
    String(value ?? '—').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char] || char)

  const downloadCSV = () => {
    if (!reportRows.length) return

    const headers = [
      'Transaction ID', 'Reference', 'Customer', 'Product',
      'City', 'Amount INR', 'Risk Score', 'Decision', 'Status',
      'New Address', 'Attempts in 10 Minutes', 'Account Age Days',
      'Device ID', 'Created At'
    ]

    const rows = reportRows.map(t => [
      t.id, t.reference, t.customer, t.product, t.city,
      t.amount, t.risk_score, t.decision, t.status,
      t.new_address, t.attempts_10m, t.account_age_days,
      t.device_id, t.created_at
    ])

    const quote = (v: any) =>
      `"${String(v ?? '').replace(/"/g, '""')}"`

    const csv = '\uFEFF' +
      [headers, ...rows]
        .map(row => row.map(quote).join(','))
        .join('\r\n')

    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    )

    const link = document.createElement('a')
    link.href = url
    link.download = mode === 'SINGLE'
      ? `GadgetHub-${selected?.reference || 'transaction'}-report.csv`
      : 'GadgetHub-All-Transactions-Report.csv'

    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const downloadPDF = () => {
    if (!reportRows.length) return

    const isSingle = mode === 'SINGLE'
    const title = isSingle
      ? 'Individual Transaction Report'
      : 'Complete Transaction Report'

    const tableRows = reportRows.map(t => `
      <tr>
        <td>${escapeHTML(t.reference)}</td>
        <td>${escapeHTML(t.customer)}</td>
        <td>${escapeHTML(t.product)}</td>
        <td>${escapeHTML(t.city)}</td>
        <td>${escapeHTML(money(t.amount))}</td>
        <td>${escapeHTML(t.risk_score)}</td>
        <td>${escapeHTML(t.decision)}</td>
        <td>${escapeHTML(t.status)}</td>
        <td>${escapeHTML(dateText(t.created_at))}</td>
      </tr>
    `).join('')

    const singleDetails = isSingle && selected ? `
      <h2>Transaction Information</h2>
      <div class="details">
        <p><b>Reference:</b> ${escapeHTML(selected.reference)}</p>
        <p><b>Customer:</b> ${escapeHTML(selected.customer)}</p>
        <p><b>Product:</b> ${escapeHTML(selected.product)}</p>
        <p><b>City:</b> ${escapeHTML(selected.city)}</p>
        <p><b>Amount:</b> ${escapeHTML(money(selected.amount))}</p>
        <p><b>Risk Score:</b> ${escapeHTML(selected.risk_score)} / 100</p>
        <p><b>Decision:</b> ${escapeHTML(selected.decision)}</p>
        <p><b>Status:</b> ${escapeHTML(selected.status)}</p>
        <p><b>New Address:</b> ${escapeHTML(selected.new_address == null ? 'Not recorded' : selected.new_address ? 'Yes' : 'No')}</p>
        <p><b>Attempts / 10 min:</b> ${escapeHTML(selected.attempts_10m ?? 'Not recorded')}</p>
        <p><b>Account Age:</b> ${escapeHTML(selected.account_age_days == null ? 'Not recorded' : `${selected.account_age_days} days`)}</p>
        <p><b>Device ID:</b> ${escapeHTML(selected.device_id || 'Not recorded')}</p>
        <p><b>Created At:</b> ${escapeHTML(dateText(selected.created_at))}</p>
        <p><b>Database Record ID:</b> ${escapeHTML(selected.id)}</p>
      </div>
    ` : ''

    const summary = isSingle ? '' : `
      <div class="summary">
        <div><small>Total Transactions</small><b>${records.length}</b></div>
        <div><small>Payment Volume</small><b>${escapeHTML(money(totalAmount))}</b></div>
        <div><small>Approved</small><b>${count('APPROVE')}</b></div>
        <div><small>Challenged</small><b>${count('CHALLENGE')}</b></div>
        <div><small>Under Review</small><b>${count('REVIEW')}</b></div>
        <div><small>Declined</small><b>${count('DECLINE')}</b></div>
      </div>
    `

    const printWindow = window.open('', '_blank')

    if (!printWindow) {
      alert('Please allow pop-ups to generate the PDF report.')
      return
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escapeHTML(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; color: #222; }
          h1 { color: #8b2ca3; margin-bottom: 5px; }
          h2 { margin-top: 28px; }
          .subtitle { color: #666; font-size: 12px; }
          .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 25px 0; }
          .summary div { border: 1px solid #ddd; padding: 12px; border-radius: 7px; }
          .summary small, .summary b { display: block; }
          .summary small { color: #666; margin-bottom: 8px; }
          .summary b { font-size: 18px; }
          .details { display: grid; grid-template-columns: 1fr 1fr; gap: 0 25px; border: 1px solid #ddd; padding: 15px; }
          .details p { font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px; }
          th { background: #29202f; color: white; text-align: left; }
          th, td { border: 1px solid #ddd; padding: 8px 6px; overflow-wrap: anywhere; }
          tr:nth-child(even) { background: #f5f3f6; }
          .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; color: #666; font-size: 10px; }
          @media print { body { padding: 10px; } tr { page-break-inside: avoid; } }
        </style>
      </head>
      <body>
        <h1>GADGETHUB.AI</h1>
        <h2>${escapeHTML(title)}</h2>
        <p class="subtitle">Risk Intelligence · Generated ${escapeHTML(new Date().toLocaleString('en-IN'))}</p>
        ${summary}
        ${singleDetails}
        <h2>Transaction Records (${reportRows.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Reference</th><th>Customer</th><th>Product</th>
              <th>City</th><th>Amount</th><th>Risk</th>
              <th>Decision</th><th>Status</th><th>Date</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div class="footer">
          Generated from transaction records returned by the GadgetHub backend API.
          Fields not stored by the backend are not included.
        </div>
      </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.focus()
    printWindow.onload = () => printWindow.print()
  }

  return (
    <div className="reports-page">
      <section className="panel">
        <PanelTitle
          title="Transaction Reporting Center"
          sub="Generate, inspect and export transaction reports from the backend database"
          action={<span className="status-badge success">API DATA · {records.length} RECORDS</span>}
        />

        <div className="report-grid">
          <ReportMetric title="Total Transactions" value={records.length.toLocaleString('en-IN')} note="Records returned by transactions API" />
          <ReportMetric title="Payment Volume" value={money(totalAmount)} note="Sum of returned transaction amounts" />
          <ReportMetric title="Flagged Transactions" value={records.filter(t => Number(t.risk_score || 0) >= 25).length} note="Risk score 25 or higher" />
          <ReportMetric title="Approved" value={count('APPROVE')} note="APPROVE decisions" />
          <ReportMetric title="Challenged" value={count('CHALLENGE')} note="CHALLENGE decisions" />
          <ReportMetric title="Reviewed / Declined" value={count('REVIEW') + count('DECLINE')} note={`${count('REVIEW')} review · ${count('DECLINE')} decline`} />
        </div>

        <div className="evidence-note">
          <FileText size={18} />
          <div>
            <b>Report data source</b>
            <p>Reports are generated from actual transaction records returned by the connected backend API. No artificial transactions are created.</p>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <PanelTitle
          title="Generate Transaction Report"
          sub="Choose between a complete transaction report and an individual transaction report"
        />

        <div className="report-mode-switch">
          <button className={`btn ${mode === 'ALL' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('ALL')}>
            <FileText size={15} /> All Transactions
          </button>
          <button className={`btn ${mode === 'SINGLE' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('SINGLE')}>
            <Eye size={15} /> Individual Transaction
          </button>
        </div>

        {mode === 'SINGLE' && (
          <div className="individual-report-search">
            <label className="field">
              <span>Search Transaction Reference or Customer</span>
              <div className="search-box">
                <Search size={16} />
                <input
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    setSelectedId(null)
                  }}
                  placeholder="Example: GH-9207D81C9BCE or customer name"
                />
              </div>
            </label>

            {search.trim() && (
              <div className="report-search-results">
                {matching.slice(0, 8).map(t => (
                  <button
                    key={t.id}
                    className={`report-search-item ${selected?.id === t.id ? 'selected' : ''}`}
                    onClick={() => setSelectedId(t.id)}
                  >
                    <span>
                      <b>{t.reference}</b>
                      <small>{t.customer} · {t.product}</small>
                    </span>
                    <span className="amount">{money(t.amount)}</span>
                  </button>
                ))}
                {matching.length === 0 && <div className="no-data">No matching transaction found.</div>}
              </div>
            )}
          </div>
        )}

        {mode === 'SINGLE' && selected ? (
          <div className="individual-report-card">
            <div className="drawer-header">
              <div>
                <span className="eyebrow">SELECTED TRANSACTION</span>
                <h2>{selected.reference}</h2>
                <p>{selected.customer}</p>
              </div>
              <span className={`decision-chip ${(selected.decision || 'approve').toLowerCase()}`}>
                {selected.decision}
              </span>
            </div>

            <div className="report-grid">
              <ReportMetric title="Amount" value={money(selected.amount)} note="Transaction amount" />
              <ReportMetric title="Risk Score" value={`${selected.risk_score ?? 0}/100`} note="Backend risk score" />
              <ReportMetric title="Product" value={selected.product || '—'} note="Purchased product" />
              <ReportMetric title="City" value={selected.city || '—'} note="Transaction city" />
            </div>

            <DetailSection title="Transaction details">
              <Detail label="Database ID" value={selected.id} />
              <Detail label="Reference" value={selected.reference} />
              <Detail label="Customer" value={selected.customer} />
              <Detail label="Product" value={selected.product} />
              <Detail label="City" value={selected.city} />
              <Detail label="Amount" value={money(selected.amount)} />
              <Detail label="Risk Score" value={`${selected.risk_score ?? 0}/100`} />
              <Detail label="Decision" value={selected.decision} />
              <Detail label="Status" value={selected.status} />
              <Detail label="New Address" value={selected.new_address == null ? 'Not recorded' : selected.new_address ? 'Yes' : 'No'} />
              <Detail label="Attempts / 10 min" value={selected.attempts_10m ?? 'Not recorded'} />
              <Detail label="Account Age" value={selected.account_age_days == null ? 'Not recorded' : `${selected.account_age_days} days`} />
              <Detail label="Device ID" value={selected.device_id || 'Not recorded'} />
              <Detail label="Created At" value={dateText(selected.created_at)} />
            </DetailSection>
          </div>
        ) : mode === 'SINGLE' ? (
          <div className="no-data">
            {search.trim()
              ? 'No matching transaction available.'
              : 'Enter a transaction reference or customer name to find a transaction.'}
          </div>
        ) : (
          <div className="table-summary">
            <span><b>{records.length}</b> transactions included in this report</span>
            <span>All records returned by the backend API</span>
          </div>
        )}

        <div className="report-download-actions">
          <button className="btn btn-primary" disabled={!reportRows.length} onClick={downloadCSV}>
            <Download size={16} /> Download CSV
          </button>
          <button className="btn btn-secondary" disabled={!reportRows.length} onClick={downloadPDF}>
            <FileText size={16} /> Print / Save PDF
          </button>
        </div>

        <p className="muted tiny">
          CSV downloads directly. PDF opens a print-ready report; choose "Save as PDF" in your browser's print destination.
        </p>
      </section>

      {mode === 'ALL' && (
        <section className="panel" style={{ marginTop: 18 }}>
          <PanelTitle title="Complete Transaction Register" sub="Preview of the transactions included in the full report" />
          <TransactionTable rows={records} />
        </section>
      )}

      <section className="panel" style={{ marginTop: 18 }}>
        <PanelTitle title="Reporting Policy" sub="Decision bands used by the current backend risk policy" />
        <div className="evidence-note">
          <Target size={18} />
          <div>
            <b>Risk policy bands</b>
            <p>Approve 0–24 · Challenge 25–49 · Review 50–74 · Decline 75–100. These are configured decision bands, not independent proof of fraud.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

function NetworkPage() {
  return (
    <section className="panel">
      <PanelTitle title="Fraud network intelligence" sub="Conceptual entity-link analysis — illustrative, not live graph data" />
      <div className="network-visual">
        <div className="network-node central"><Fingerprint size={25} /><b>Shared device</b><small>Example entity</small></div>
        <div className="network-node n1">Micro-payment attempts<small>Illustrative event group</small></div>
        <div className="network-node n2">Account A<small>Example profile</small></div>
        <div className="network-node n3">Account B<small>Example profile</small></div>
        <div className="network-node n4">IP cluster<small>Example signal</small></div>
        <div className="network-lines" />
      </div>
      <p className="muted tiny">A live relationship graph requires stored device/account/IP relationships, entity resolution and false-link controls.</p>
    </section>
  )
}

function AuditPage({ transactions, alerts }: any) {
  const events = [
    ...transactions.map((t: Transaction) => ({
      id: `t-${t.id}`,
      title: `Transaction ${t.reference} screened`,
      detail: `${t.customer} · ${t.decision} · ${money(t.amount)}`,
      time: t.created_at
    })),
    ...alerts.map((a: any) => ({
      id: `a-${a.id}`,
      title: a.title,
      detail: `Alert ${a.id} · ${a.status}`,
      time: undefined
    }))
  ]

  return (
    <section className="panel">
      <PanelTitle title="Available activity records" sub="Events inferred from currently stored transactions and alerts" />
      {events.length
        ? events.map(e => (
          <div className="audit-item" key={e.id}>
            <span className="live-dot" />
            <div><b>{e.title}</b><small>{e.detail} · {dateText(e.time)}</small></div>
            <span>DB</span>
          </div>
        ))
        : <div className="no-data">No activity records available.</div>}
      <p className="muted tiny">This view is assembled from current API records; it is not a tamper-proof audit log.</p>
    </section>
  )
}

function SettingsPage() {
  return (
    <section className="panel">
      <PanelTitle title="Workspace settings" sub="Current application configuration" />
      <div className="settings-row">
        <div><b>Risk policy thresholds</b><p>Approve 0–24 · Challenge 25–49 · Review 50–74 · Decline 75–100</p></div>
        <span className="status-badge">CURRENT POLICY</span>
      </div>
      <div className="settings-row">
        <div><b>Data environment</b><p>Local backend database; data availability depends on stored records.</p></div>
        <span className="status-badge success">LOCAL</span>
      </div>
      <div className="settings-row">
        <div><b>API service</b><p>FastAPI · /api/v1 · OpenAPI documentation enabled</p></div>
        <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">Open API docs ↗</a>
      </div>
    </section>
  )
}

export default App
