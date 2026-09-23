export default function Loading({error}:{error?:string}){return <div className="card">{error?<span className="error">{error}</span>:<span className="subtitle">Loading dashboard…</span>}</div>}
