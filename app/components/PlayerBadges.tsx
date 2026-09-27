import {Medal} from 'lucide-react';
import type {PlayerBadge} from '@/lib/player-badges';
export default function PlayerBadges({badges}:{badges:PlayerBadge[]}){
 return <section className="player-badges" aria-label="Player badges"><h3>Badges</h3>{badges.length?<div className="badge-grid">{badges.map(b=><article className="earned-badge" key={b.id}><Medal aria-hidden="true"/><div><strong>{b.label}{b.count>1?` ×${b.count}`:''}</strong><p>{b.detail}</p></div></article>)}</div>:<p>No badges yet. Team membership and confirmed match achievements will appear here.</p>}</section>;
}
