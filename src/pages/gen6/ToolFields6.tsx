import type { ReactNode } from 'react';
import { fieldClass, labelClass } from './fields';

export function Select6({label,value,options,change}: {label:string;value:string|number;options:readonly (readonly [string|number,string])[];change:(v:string)=>void}) {
  return <label className={labelClass}>{label}<select className={fieldClass} value={value} onChange={e=>change(e.target.value)}>
    {options.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>;
}
export function Check6({label,value,change}:{label:string;value:boolean;change:(v:boolean)=>void}) {
  return <label className="flex gap-2 items-center min-h-9"><input type="checkbox" checked={value} onChange={e=>change(e.target.checked)}/>{label}</label>;
}
export function Text6({label,value,change,limit}:{label:string;value:string;change:(v:string)=>void;limit?:number}) {
  return <label className={labelClass}>{label}<input className={fieldClass} value={value} maxLength={limit} onChange={e=>change(e.target.value)}/></label>;
}
export function Pair6({children}:{children:ReactNode}) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}
