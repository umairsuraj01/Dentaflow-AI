import{c}from"./index-zYn_1MAr.js";import{u as m,a as l,b as o}from"./vendor-query-CS4Wn07t.js";import{c as a}from"./case.service-_3-NZSQ1.js";/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=c("CircleCheck",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const q=c("Move3d",[["path",{d:"M5 3v16h16",key:"1mqmf9"}],["path",{d:"m5 19 6-6",key:"jh6hbb"}],["path",{d:"m2 6 3-3 3 3",key:"tkyvxa"}],["path",{d:"m18 16 3 3-3 3",key:"1d4glt"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const M=c("Upload",[["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["polyline",{points:"17 8 12 3 7 8",key:"t8dd8p"}],["line",{x1:"12",x2:"12",y1:"3",y2:"15",key:"widbto"}]]);function C(e){const n=m(),t=["case",e],i=l({queryKey:t,queryFn:()=>a.getById(e),enabled:!!e}),u=o({mutationFn:()=>a.approve(e),onSuccess:()=>n.invalidateQueries({queryKey:t})}),r=o({mutationFn:s=>a.requestRevision(e,s),onSuccess:()=>n.invalidateQueries({queryKey:t})}),y=o({mutationFn:()=>a.cancel(e),onSuccess:()=>n.invalidateQueries({queryKey:t})}),d=o({mutationFn:s=>a.addNote(e,s),onSuccess:()=>n.invalidateQueries({queryKey:t})});return{caseData:i.data,isLoading:i.isLoading,approve:u.mutateAsync,requestRevision:r.mutateAsync,cancelCase:y.mutateAsync,addNote:d.mutateAsync,refetch:i.refetch}}export{k as C,q as M,M as U,C as u};
