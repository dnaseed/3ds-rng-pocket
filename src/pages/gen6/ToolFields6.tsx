import type { ReactNode } from 'react';
import { fieldClass, labelClass } from './fields';

export function Select6({label,value,options,change}: {label:string;value:string|number;options:readonly (readonly [string|number,string])[];change:(v:string)=>void}) {
  return <label className={labelClass}>{label}<select className={fieldClass} value={value} onChange={e=>change(e.target.value)}>
    {options.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>;
}
export function Check6({label,value,change}:{label:string;value:boolean;change:(v:boolean)=>void}) {
  return <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold has-checked:border-amber-500 has-checked:text-amber-300">
    <input type="checkbox" className="size-4 shrink-0 accent-amber-500" checked={value}
      onChange={event => change(event.target.checked)} />
    {label}
  </label>;
}
export function Text6({label,value,change,limit}:{label:string;value:string;change:(v:string)=>void;limit?:number}) {
  return <label className={labelClass}>{label}<input className={fieldClass} value={value} maxLength={limit} onChange={e=>change(e.target.value)}/></label>;
}
export function Pair6({children}:{children:ReactNode}) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}
