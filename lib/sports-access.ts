export type SportsRole={user_id:string;role:string;school_id:string|null;team_id:string|null;active:boolean};
export function canManageTeam(roles:SportsRole[],team:{id:string;school_id:string}){return roles.some(r=>r.active&&(r.role==='super_admin'||(r.role==='school_admin'&&r.school_id===team.school_id)||(r.role==='coach'&&r.school_id===team.school_id&&r.team_id===team.id)));}
