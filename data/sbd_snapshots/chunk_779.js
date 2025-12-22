"use strict";(globalThis.webpackChunkswrc_plugin=globalThis.webpackChunkswrc_plugin||[]).push([[779],{779:(e,t,r)=>{r.r(t),r.d(t,{PublicBettingTrends:()=>p});var o=r(948),s=r(999),a=r(578),i=r(689),n=(r(606),r(655)),l=r(464),d=Object.defineProperty,c=Object.getOwnPropertyDescriptor,b=(e,t,r,o)=>{for(var s,a=o>1?void 0:o?c(t,r):t,i=e.length-1;i>=0;i--)(s=e[i])&&(a=(o?s(t,r,a):s(a))||a);return o&&a&&d(t,r,a),a};const h={label:"All",value:"all"};let p=class extends o.a{constructor(){super(...arguments),this.sponsoredOfferIndex=4,this._betType=o.B.MONEYLINE,this._oddsFormat=o.O.AMERICAN,this._hasSponsoredOfferSlot=!1,this._filterKey=h.value,this._fetchBettingSplitsDataTask=new i.h(this,{task:async([e,t,r],{signal:s})=>{var a,n;const l=null==(a=null==t?void 0:t.map((e=>e.id)))?void 0:a.filter(Boolean),d=l.length>0?l:["no_valid_books"],c=await fetch((0,i.o)(e,d,(0,i.g)(r)),{signal:s});if(!c.ok)throw new Error(`Failed to fetch odds: ${c.status} ${c.statusText}`);const b=await c.json();if((null==(n=null==b?void 0:b.data)?void 0:n.length)>0)return b;throw Error(o.b.NO_UPCOMING_GAMES)},args:()=>[this.league,this.books,this._oddsFormat]}),this._handleOddsFormatChange=e=>{const t=e.target.value;(0,i.a)(t)&&(document.startViewTransition?document.startViewTransition((()=>{this._oddsFormat=t})):this._oddsFormat=t)},this._handleFilterKeyChange=e=>{const t=e.target.value;document.startViewTransition?document.startViewTransition((()=>{this._filterKey=t})):this._filterKey=t},this._handleBetTypeChange=e=>{document.startViewTransition?document.startViewTransition((()=>{this._betType=e})):this._betType=e},this._renderError=e=>(console.info(`${this.tagName}: ${e}`),o.x`<slot name="no-data"></slot>`)}willUpdate(e){e.has("league")&&(this._betType=["mlb","nhl"].includes(this.league)?o.B.MONEYLINE:o.B.SPREAD)}_onSponsoredOfferSlotChange(){this._hasSponsoredOfferSlot=this._sponsoredOfferNodes.length>0}missingRequiredProperties(){return!this.league}_renderTableHead(){return o.x`<thead class="sticky top-0 z-10 font-bold font-body-bold">
      <tr class="bg-base-100">
        <th colspan="4" class="md:hidden">
          <srwc-group-select
            .callback="${this._handleBetTypeChange}"
            .options="${Object.values(o.B).map((e=>({key:e,value:e})))}"
            class="mt-2 block"
            .selected="${this._betType}">
          </srwc-group-select>
        </th>
      </tr>
      
      <tr class="bg-base-100 md:hidden">
        <th class="w-2/6 sm:w-1/4 py-4 border-b border-base-200">Matchup</th>
        <th class="w-2/6 sm:w-1/4 py-4 border-b border-base-200 capitalize">${this._betType}</th>
        <th class="w-1/6 sm:w-1/4 py-4 border-b border-base-200" title="Bet Percent">BET%</th>
        <th class="w-1/6 sm:w-1/4 py-4 border-b border-base-200" title="Money Percent">$%</th>
      </tr>

      
      <tr class="bg-base-100 hidden md:table-row">
        <th class="w-[15%] py-4 border-b border-base-200">Matchup</th>
        ${Object.values(o.B).map((e=>o.x`<th class="w-[11.66%] py-4 border-b border-base-200 capitalize">${e}</th>
              <th class="w-1/12 py-4 border-b border-base-200">BET%</th>
              <th class="w-1/12 py-4 border-b border-base-200">$%</th>`))}
      </tr>
    </thead>`}render(){var e,t;if(this.missingRequiredProperties())return console.warn(`${this.tagName}: Misconfigured property`),o.x`<slot name="no-data"></slot>`;const r=[h,...(null==(t=null==(e=this._fetchBettingSplitsDataTask.value)?void 0:e.filter_keys)?void 0:t.map((e=>({label:e,value:e}))))??[h]];return o.x`
      <div global-css class="min-w-86">
        ${this._fetchBettingSplitsDataTask.status===i.s.ERROR?this._renderError(o.b.NO_UPCOMING_GAMES):o.x`<div class="flex flex-col gap-2 sm:flex-row mb-4">
                <srwc-select-dropdown
                  ?disabled="${this._fetchBettingSplitsDataTask.status===i.s.PENDING}"
                  label="filter upcoming games"
                  _id="conference-filter"
                  class="sm:flex-1 md:flex-none md:min-w-64"
                  .selected="${this._filterKey}"
                  .options="${r}"
                  .onChange="${this._handleFilterKeyChange}">
                </srwc-select-dropdown>
                <srwc-select-dropdown
                  label="select odds format"
                  _id="odds-format-filter"
                  class="sm:flex-1 md:flex-none md:min-w-64"
                  .selected="${this._oddsFormat}"
                  .options="${Object.values(o.O).map((e=>({label:e,value:e})))}"
                  .onChange="${this._handleOddsFormatChange}">
                </srwc-select-dropdown>
              </div>
              <hr class="border-base-200 mb-2 md:mb-0" />
              <table class="text-sm w-full text-center border-separate border-spacing-0 font-body">
                ${this._renderTableHead()}
                ${this._fetchBettingSplitsDataTask.render({complete:e=>{const t=e.data.filter((e=>"all"===this._filterKey||e.filter_key[this._filterKey]));return o.x` ${t.map(((e,t)=>o.x`${t===this.sponsoredOfferIndex?this._renderSponsoredOfferSlot(10):o.E}
                      ${this._renderTableBody(e,t)}`))}
                    ${t&&this.sponsoredOfferIndex>=t.length?this._renderSponsoredOfferSlot(10):o.E}`}})}
              </table>
              ${this._fetchBettingSplitsDataTask.render({pending:()=>m(),error:this._renderError})}`}
      </div>
    `}_renderSponsoredOfferSlot(e=4){return o.x`
      <tbody class=${this._hasSponsoredOfferSlot?"":"hidden"}>
        <tr>
          <td colspan="${e}" class="py-4">
            <slot @slotchange=${this._onSponsoredOfferSlotChange} name="sponsored-offer"></slot>
          </td>
        </tr>
      </tbody>
    `}_renderDynamicBestOddsTableCellByBetType(e,t){var r,s;let a="";const i=null==e?void 0:e[this._betType];return i&&(this._betType===o.B.TOTAL?a=`${t[0]} ${null==i?void 0:i.total}`:this._betType===o.B.MONEYLINE?a=null==(r=i[t])?void 0:r.odds:this._betType===o.B.SPREAD&&(a=null==(s=i[t])?void 0:s.spread)),o.x`<td class="pb-1 md:hidden">${this._renderOddsCellLink(i,a)}</td>`}_renderTableBody(e,t){var r,s,l,d,c,b,h,p,m,v,g,f,w,y,x,k,$,_,S,O,T,z,C,N,M,j,P,E,B,R,F,L,A,U,D,I,K,H,W,V,G,Y;const{bettingSplits:q,scheduled:J,competitors:Q,markets:X}=e,Z=(0,i.f)(J,i.d),ee=Q.home,te=Q.away,re=X.moneyline.books.find((e=>{var t;return null==(t=null==e?void 0:e.away)?void 0:t.best}))||X.moneyline.books[0],oe=X.moneyline.books.find((e=>{var t;return null==(t=null==e?void 0:e.home)?void 0:t.best}))||X.moneyline.books[0],se=X.total.books.find((e=>{var t;return null==(t=null==e?void 0:e.over)?void 0:t.best}))||X.total.books[0],ae=X.total.books.find((e=>{var t;return null==(t=null==e?void 0:e.under)?void 0:t.best}))||X.total.books[0],ie={moneyline:re,spread:X.spread.books.find((e=>{var t;return null==(t=null==e?void 0:e.away)?void 0:t.best}))||X.spread.books[0],total:se},ne={moneyline:oe,spread:X.spread.books.find((e=>{var t;return null==(t=null==e?void 0:e.home)?void 0:t.best}))||X.spread.books[0],total:ae},le="total"===this._betType?"over":"away",de="total"===this._betType?"under":"home",ce=null==(s=null==(r=null==q?void 0:q.moneyline)?void 0:r.away)?void 0:s.stakePercentage,be=null==(d=null==(l=null==q?void 0:q.moneyline)?void 0:l.away)?void 0:d.betsPercentage,he=null==(b=null==(c=null==q?void 0:q.moneyline)?void 0:c.home)?void 0:b.stakePercentage,pe=null==(p=null==(h=null==q?void 0:q.moneyline)?void 0:h.home)?void 0:p.betsPercentage,ue=null==(v=null==(m=null==q?void 0:q.spread)?void 0:m.away)?void 0:v.stakePercentage,me=null==(f=null==(g=null==q?void 0:q.spread)?void 0:g.away)?void 0:f.betsPercentage,ve=null==(y=null==(w=null==q?void 0:q.spread)?void 0:w.home)?void 0:y.stakePercentage,ge=null==(k=null==(x=null==q?void 0:q.spread)?void 0:x.home)?void 0:k.betsPercentage,fe=null==(_=null==($=null==q?void 0:q.total)?void 0:$.over)?void 0:_.stakePercentage,we=null==(O=null==(S=null==q?void 0:q.total)?void 0:S.over)?void 0:O.betsPercentage,ye=null==(z=null==(T=null==q?void 0:q.total)?void 0:T.under)?void 0:z.stakePercentage,xe=null==(N=null==(C=null==q?void 0:q.total)?void 0:C.under)?void 0:N.betsPercentage,ke=null==(j=null==(M=null==q?void 0:q[this._betType])?void 0:M[le])?void 0:j.stakePercentage,$e=null==(E=null==(P=null==q?void 0:q[this._betType])?void 0:P[le])?void 0:E.betsPercentage,_e=null==(R=null==(B=null==q?void 0:q[this._betType])?void 0:B[de])?void 0:R.stakePercentage,Se=null==(L=null==(F=null==q?void 0:q[this._betType])?void 0:F[de])?void 0:L.betsPercentage;return o.x`<tbody class="text-base-300">
      <tr>
        <td colspan="10" class="${"text-start border-base-200 pb-2 pt-4 "+(0!==t?"border-t":"")}">
          <time datetime="${J}" class="font-body font-normal">${Z}</time>
        </td>
      </tr>
      <tr>
        <th class="text-start">
          <div class="py-2 flex items-center gap-2 font-bold font-body-bold">
            ${(0,a.t)(te,this.league)} ${te.abbreviation}
          </div>
        </th>

        
        ${this._renderDynamicBestOddsTableCellByBetType(ie,le)}
        <td class="md:hidden">
          <div class="flex items-center justify-center gap-1">
            ${u($e)}
            ${$e?Math.round($e)+"%":o.N}
          </div>
        </td>
        <td class="md:hidden">
          <div class="flex items-center justify-center gap-1">
            ${u(ke)}
            ${ke?Math.round(ke)+"%":o.N}
          </div>
        </td>

        
        <td class="pb-1 hidden md:table-cell">
          ${this._renderOddsCellLink(ie.moneyline,null==(U=null==(A=null==ie?void 0:ie.moneyline)?void 0:A.away)?void 0:U.odds)}
        </td>
        <td class="hidden md:table-cell">
          <div class="flex items-center justify-center gap-1">
            ${u(be)}
            ${be?Math.round(be)+"%":o.N}
          </div>
        </td>
        <td class="hidden md:table-cell">
          <div class="flex items-center justify-center gap-1">
            ${u(ce)}
            ${ce?Math.round(ce)+"%":o.N}
          </div>
        </td>
        <td class="pb-1 hidden md:table-cell">
          ${this._renderOddsCellLink(ie.spread,null==(I=null==(D=null==ie?void 0:ie.spread)?void 0:D.away)?void 0:I.spread)}
        </td>
        <td class="hidden md:table-cell">
          <div class="flex items-center justify-center gap-1">
            ${u(me)}
            ${me?Math.round(me)+"%":o.N}
          </div>
        </td>
        <td class="hidden md:table-cell">
          <div class="flex items-center justify-center gap-1">
            ${u(ue)}
            ${ue?Math.round(ue)+"%":o.N}
          </div>
        </td>
        <td class="pb-1 hidden md:table-cell">
          ${this._renderOddsCellLink(null==ie?void 0:ie.total,null!=(K=null==ie?void 0:ie.total)&&K.total?`o ${ie.total.total}`:null)}
        </td>
        <td class="hidden md:table-cell">
          <div class="flex items-center justify-center gap-1">
            ${u(we)}
            ${we?Math.round(we)+"%":o.N}
          </div>
        </td>
        <td class="hidden md:table-cell">
          <div class="flex items-center justify-center gap-1">
            ${u(fe)}
            ${fe?Math.round(fe)+"%":o.N}
          </div>
        </td>
      </tr>

      <tr>
        <th class="text-start">
          <div class="py-2 flex items-center gap-2 font-bold font-body-bold">
            ${(0,a.t)(ee,this.league)} ${ee.abbreviation}
          </div>
        </th>

        
        ${this._renderDynamicBestOddsTableCellByBetType(ne,de)}
        <td class="md:hidden">
          <div class="flex items-center justify-center gap-1">
            ${u(Se)}
            ${Se?Math.round(Se)+"%":o.N}
          </div>
        </td>
        <td class="md:hidden">
          <div class="flex items-center justify-center gap-1">
            ${u(_e)}
            ${_e?Math.round(_e)+"%":o.N}
          </div>
        </td>

        
        <td class="pb-1 hidden md:table-cell">
          ${this._renderOddsCellLink(null==ne?void 0:ne.moneyline,null==(W=null==(H=null==ne?void 0:ne.moneyline)?void 0:H.home)?void 0:W.odds)}
        </td>
        <td class="hidden md:table-cell">
          <div class="flex items-center justify-center gap-1">
            ${u(pe)}
            ${pe?Math.round(pe)+"%":o.N}
          </div>
        </td>
        <td class="hidden md:table-cell">
          <div class="flex items-center justify-center gap-1">
            ${u(he)}
            ${he?Math.round(he)+"%":o.N}
          </div>
        </td>
        <td class="pb-1 hidden md:table-cell">
          ${this._renderOddsCellLink(null==ne?void 0:ne.spread,null==(G=null==(V=null==ne?void 0:ne.spread)?void 0:V.home)?void 0:G.spread)}
        </td>
        <td class="hidden md:table-cell">
          <div class="flex items-center justify-center gap-1">
            ${u(ge)}
            ${ge?Math.round(ge)+"%":o.N}
          </div>
        </td>
        <td class="hidden md:table-cell">
          <div class="flex items-center justify-center gap-1">
            ${u(ve)}
            ${ve?Math.round(ve)+"%":o.N}
          </div>
        </td>
        <td class="pb-1 hidden md:table-cell">
          ${this._renderOddsCellLink(null==ne?void 0:ne.total,null!=(Y=null==ne?void 0:ne.total)&&Y.total?`u ${ne.total.total}`:null)}
        </td>
        <td class="hidden md:table-cell">
          <div class="flex items-center justify-center gap-1">
            ${u(xe)}
            ${xe?Math.round(xe)+"%":o.N}
          </div>
        </td>
        <td class="hidden md:table-cell">
          <div class="flex items-center justify-center gap-1">
            ${u(ye)}
            ${ye?Math.round(ye)+"%":o.N}
          </div>
        </td>
      </tr>

      <tr>
        <th colspan="2">
          <a
            href="${n.$.generateLinkToMatchup(e)}"
            class="h-6 mb-4 mt-2 flex gap-1 items-center hover:text-base-content font-bold font-body-bold">
            <span style="mask: var(--ico-sports-svg);" class="bg-base-content w-6 h-6"></span>
            Matchup Report
          </a>
        </th>
      </tr>
    </tbody>`}_renderOddsCellLink(e,t){var r;if(!e)return o.x`<div class="border border-base-200 rounded-sm min-h-[52px] flex items-center justify-center">
        ${o.N}
      </div>`;const s=null==(r=this.books.find((t=>t.id===(null==e?void 0:e.id))))?void 0:r.clickUrl,a={operator:null==e?void 0:e.name};return(0,l.E)(o.x`
        <div
          class="group focus:outline-success hover:text-base-100 border border-base-200 rounded-sm min-h-[52px] flex items-center justify-center gap-2 hover:border-success hover:bg-success">
          <img
            loading="lazy"
            src="${i.c.partnerLogo(e.name)}"
            class="rounded-full"
            width="24"
            height="24"
            alt="${e.name} logo" />
          <p class="flex flex-col text-center font-bold font-body-bold">${t||o.N}</p>
        </div>
      `,s,a)}};p.styles=[o.g,o.i`
      :host {
        ${(0,o.r)(`--ico-sports-svg: url("${(0,o.r)(a.s)}") center/contain no-repeat;`)}
      }
      /* layer: properties */
@supports ((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b)))){*, ::before, ::after, ::backdrop{--un-bg-opacity:100%;--un-border-opacity:100%;--un-border-spacing-x:0;--un-border-spacing-y:0;--un-content:"";--un-text-opacity:100%;--un-outline-opacity:100%;--un-space-x-reverse:0;--un-space-y-reverse:0;--un-translate-x:0;--un-translate-y:0;--un-translate-z:0;}}
@property --un-text-opacity{syntax:"<percentage>";inherits:false;initial-value:100%;}
@property --un-outline-opacity{syntax:"<percentage>";inherits:false;initial-value:100%;}
@property --un-border-opacity{syntax:"<percentage>";inherits:false;initial-value:100%;}
@property --un-bg-opacity{syntax:"<percentage>";inherits:false;initial-value:100%;}
@property --un-border-spacing-x{syntax:"<length>";inherits:false;initial-value:0;}
@property --un-border-spacing-y{syntax:"<length>";inherits:false;initial-value:0;}
/* layer: theme */
:root, :host {
--spacing: 0.25rem;
--fontWeight-bold: 700;
--font-body-bold: var(--srwc-font-body-bold, arial, sans-serif);
--radius-sm: var(--srwc-radius-sm, 0.25rem);
--default-transition-timingFunction: cubic-bezier(0.4, 0, 0.2, 1);
--default-transition-duration: 150ms;
--fontWeight-normal: 400;
--container-4xl: 56rem;
--container-xs: 20rem;
--container-2xs: 18rem;
--radius-lg: var(--srwc-radius-lg, 0.5rem);
--colors-base-100: var(--srwc-color-base-100, oklch(1 0 0));
--colors-base-200: var(--srwc-color-base-200, oklch(0.92 0.0155 257.2));
--colors-success: var(--srwc-color-success, oklch(0.66 0.1209 163.1));
--colors-primary: var(--srwc-color-primary, oklch(45% .24 277.023));
--text-base-fontSize: 1rem;
--text-base-lineHeight: 1.5rem;
--text-sm-fontSize: 0.875rem;
--text-sm-lineHeight: 1.25rem;
--colors-base-content: var(--srwc-color-base-content, oklch(0.28 0.0296 256.85));
--font-body: var(--srwc-font-body, arial, sans-serif);
--default-font-family: var(--font-sans);
--default-monoFont-family: var(--font-mono);
--container-sm: 24rem;
--colors-base-300: var(--srwc-color-base-300, oklch(0.4 0.0154 237.02));
--colors-primary-content: var(--srwc-color-primary-content, oklch(1 0 0));
--colors-warning: var(--srwc-color-warning, oklch(0.83 0.1642 83.42));
--text-xs-fontSize: 0.75rem;
--text-xs-lineHeight: 1rem;
--fontWeight-black: 900;
--font-body-black: var(--srwc-font-body-black, arial, sans-serif);
--text-xl-fontSize: 1.25rem;
--text-xl-lineHeight: 1.75rem;
}
/* layer: base */
/*
  1. Prevent padding and border from affecting element width. (https://github.com/mozdevs/cssremedy/issues/4)
  2. Remove default margins and padding
  3. Reset all borders.
*/

*,
::after,
::before,
::backdrop,
::file-selector-button {
  box-sizing: border-box; /* 1 */
  margin: 0; /* 2 */
  padding: 0; /* 2 */
  border: 0 solid; /* 3 */
}

/*
  1. Use a consistent sensible line-height in all browsers.
  2. Prevent adjustments of font size after orientation changes in iOS.
  3. Use a more readable tab size.
  4. Use the user's configured \`sans\` font-family by default.
  5. Use the user's configured \`sans\` font-feature-settings by default.
  6. Use the user's configured \`sans\` font-variation-settings by default.
  7. Disable tap highlights on iOS.
*/

html,
:host {
  line-height: 1.5; /* 1 */
  -webkit-text-size-adjust: 100%; /* 2 */
  tab-size: 4; /* 3 */
  font-family: var(
    --default-font-family,
    ui-sans-serif,
    system-ui,
    sans-serif,
    'Apple Color Emoji',
    'Segoe UI Emoji',
    'Segoe UI Symbol',
    'Noto Color Emoji'
  ); /* 4 */
  font-feature-settings: var(--default-font-featureSettings, normal); /* 5 */
  font-variation-settings: var(--default-font-variationSettings, normal); /* 6 */
  -webkit-tap-highlight-color: transparent; /* 7 */
}

/*
  1. Add the correct height in Firefox.
  2. Correct the inheritance of border color in Firefox. (https://bugzilla.mozilla.org/show_bug.cgi?id=190655)
  3. Reset the default border style to a 1px solid border.
*/

hr {
  height: 0; /* 1 */
  color: inherit; /* 2 */
  border-top-width: 1px; /* 3 */
}

/*
  Add the correct text decoration in Chrome, Edge, and Safari.
*/

abbr:where([title]) {
  -webkit-text-decoration: underline dotted;
  text-decoration: underline dotted;
}

/*
  Remove the default font size and weight for headings.
*/

h1,
h2,
h3,
h4,
h5,
h6 {
  font-size: inherit;
  font-weight: inherit;
}

/*
  Reset links to optimize for opt-in styling instead of opt-out.
*/

a {
  color: inherit;
  -webkit-text-decoration: inherit;
  text-decoration: inherit;
}

/*
  Add the correct font weight in Edge and Safari.
*/

b,
strong {
  font-weight: bolder;
}

/*
  1. Use the user's configured \`mono\` font-family by default.
  2. Use the user's configured \`mono\` font-feature-settings by default.
  3. Use the user's configured \`mono\` font-variation-settings by default.
  4. Correct the odd \`em\` font sizing in all browsers.
*/

code,
kbd,
samp,
pre {
  font-family: var(
    --default-monoFont-family,
    ui-monospace,
    SFMono-Regular,
    Menlo,
    Monaco,
    Consolas,
    'Liberation Mono',
    'Courier New',
    monospace
  ); /* 1 */
  font-feature-settings: var(--default-monoFont-featureSettings, normal); /* 2 */
  font-variation-settings: var(--default-monoFont-variationSettings, normal); /* 3 */
  font-size: 1em; /* 4 */
}

/*
  Add the correct font size in all browsers.
*/

small {
  font-size: 80%;
}

/*
  Prevent \`sub\` and \`sup\` elements from affecting the line height in all browsers.
*/

sub,
sup {
  font-size: 75%;
  line-height: 0;
  position: relative;
  vertical-align: baseline;
}

sub {
  bottom: -0.25em;
}

sup {
  top: -0.5em;
}

/*
  1. Remove text indentation from table contents in Chrome and Safari. (https://bugs.chromium.org/p/chromium/issues/detail?id=999088, https://bugs.webkit.org/show_bug.cgi?id=201297)
  2. Correct table border color inheritance in all Chrome and Safari. (https://bugs.chromium.org/p/chromium/issues/detail?id=935729, https://bugs.webkit.org/show_bug.cgi?id=195016)
  3. Remove gaps between table borders by default.
*/

table {
  text-indent: 0; /* 1 */
  border-color: inherit; /* 2 */
  border-collapse: collapse; /* 3 */
}

/*
  Use the modern Firefox focus style for all focusable elements.
*/

:-moz-focusring {
  outline: auto;
}

/*
  Add the correct vertical alignment in Chrome and Firefox.
*/

progress {
  vertical-align: baseline;
}

/*
  Add the correct display in Chrome and Safari.
*/

summary {
  display: list-item;
}

/*
  Make lists unstyled by default.
*/

ol,
ul,
menu {
  list-style: none;
}

/*
  1. Make replaced elements \`display: block\` by default. (https://github.com/mozdevs/cssremedy/issues/14)
  2. Add \`vertical-align: middle\` to align replaced elements more sensibly by default. (https://github.com/jensimmons/cssremedy/issues/14#issuecomment-634934210)
      This can trigger a poorly considered lint error in some tools but is included by design.
*/

img,
svg,
video,
canvas,
audio,
iframe,
embed,
object {
  display: block; /* 1 */
  vertical-align: middle; /* 2 */
}

/*
  Constrain images and videos to the parent width and preserve their intrinsic aspect ratio. (https://github.com/mozdevs/cssremedy/issues/14)
*/

img,
video {
  max-width: 100%;
  height: auto;
}

/*
  1. Inherit font styles in all browsers.
  2. Remove border radius in all browsers.
  3. Remove background color in all browsers.
  4. Ensure consistent opacity for disabled states in all browsers.
*/

button,
input,
select,
optgroup,
textarea,
::file-selector-button {
  font: inherit; /* 1 */
  font-feature-settings: inherit; /* 1 */
  font-variation-settings: inherit; /* 1 */
  letter-spacing: inherit; /* 1 */
  color: inherit; /* 1 */
  border-radius: 0; /* 2 */
  background-color: transparent; /* 3 */
  opacity: 1; /* 4 */
}

/*
  Restore default font weight.
*/

:where(select:is([multiple], [size])) optgroup {
  font-weight: bolder;
}

/*
  Restore indentation.
*/

:where(select:is([multiple], [size])) optgroup option {
  padding-inline-start: 20px;
}

/*
  Restore space after button.
*/

::file-selector-button {
  margin-inline-end: 4px;
}

/*
  Reset the default placeholder opacity in Firefox. (https://github.com/tailwindlabs/tailwindcss/issues/3300)
*/

::placeholder {
  opacity: 1;
}

/*
  Set the default placeholder color to a semi-transparent version of the current text color in browsers that do not
  crash when using \`color-mix(…)\` with \`currentcolor\`. (https://github.com/tailwindlabs/tailwindcss/issues/17194)
*/

@supports (not (-webkit-appearance: -apple-pay-button)) /* Not Safari */ or
  (contain-intrinsic-size: 1px) /* Safari 17+ */ {
  ::placeholder {
    color: color-mix(in oklab, currentcolor 50%, transparent);
  }
}

/*
  Prevent resizing textareas horizontally by default.
*/

textarea {
  resize: vertical;
}

/*
  Remove the inner padding in Chrome and Safari on macOS.
*/

::-webkit-search-decoration {
  -webkit-appearance: none;
}

/*
  1. Ensure date/time inputs have the same height when empty in iOS Safari.
  2. Ensure text alignment can be changed on date/time inputs in iOS Safari.
*/

::-webkit-date-and-time-value {
  min-height: 1lh; /* 1 */
  text-align: inherit; /* 2 */
}

/*
  Prevent height from changing on date/time inputs in macOS Safari when the input is set to \`display: block\`.
*/

::-webkit-datetime-edit {
  display: inline-flex;
}

/*
  Remove excess padding from pseudo-elements in date/time inputs to ensure consistent height across browsers.
*/

::-webkit-datetime-edit-fields-wrapper {
  padding: 0;
}

::-webkit-datetime-edit,
::-webkit-datetime-edit-year-field,
::-webkit-datetime-edit-month-field,
::-webkit-datetime-edit-day-field,
::-webkit-datetime-edit-hour-field,
::-webkit-datetime-edit-minute-field,
::-webkit-datetime-edit-second-field,
::-webkit-datetime-edit-millisecond-field,
::-webkit-datetime-edit-meridiem-field {
  padding-block: 0;
}

/*
  Remove the additional \`:invalid\` styles in Firefox. (https://github.com/mozilla/gecko-dev/blob/2f9eacd9d3d995c937b4251a5557d95d494c9be1/layout/style/res/forms.css#L728-L737)
*/

:-moz-ui-invalid {
  box-shadow: none;
}

/*
  Correct the inability to style the border radius in iOS Safari.
*/

button,
input:where([type='button'], [type='reset'], [type='submit']),
::file-selector-button {
  appearance: button;
}

/*
  Correct the cursor style of increment and decrement buttons in Safari.
*/

::-webkit-inner-spin-button,
::-webkit-outer-spin-button {
  height: auto;
}

/*
  Make elements with the HTML hidden attribute stay hidden by default.
*/

[hidden]:where(:not([hidden='until-found'])) {
  display: none !important;
}
/* layer: shortcuts */
.global-css,
[global-css=""]{color:color-mix(in srgb, var(--colors-base-content) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-content, oklch(0.28 0.0296 256.85)) */;font-family:var(--font-body);background-color:color-mix(in srgb, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
@supports (color: color-mix(in lab, red, red)){
.global-css{background-color:color-mix(in oklab, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.global-css{color:color-mix(in oklab, var(--colors-base-content) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-content, oklch(0.28 0.0296 256.85)) */;}
[global-css=""]{background-color:color-mix(in oklab, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
[global-css=""]{color:color-mix(in oklab, var(--colors-base-content) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-content, oklch(0.28 0.0296 256.85)) */;}
}
/* layer: default */
.text-sm{font-size:var(--text-sm-fontSize);line-height:var(--srwc-leading, var(--text-sm-lineHeight));}
.text-base-300{color:color-mix(in srgb, var(--colors-base-300) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-300, oklch(0.4 0.0154 237.02)) */;}
.hover\\:text-base-100:hover{color:color-mix(in srgb, var(--colors-base-100) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.hover\\:text-base-content:hover{color:color-mix(in srgb, var(--colors-base-content) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-content, oklch(0.28 0.0296 256.85)) */;}
.font-body{font-family:var(--font-body);}
.font-body-bold{font-family:var(--font-body-bold);}
.font-bold{--srwc-font-weight:var(--fontWeight-bold);font-weight:var(--fontWeight-bold);}
.font-normal{--srwc-font-weight:var(--fontWeight-normal);font-weight:var(--fontWeight-normal);}
.m-1{margin:calc(var(--spacing) * 1);}
.mb-2{margin-bottom:calc(var(--spacing) * 2);}
.mb-4{margin-bottom:calc(var(--spacing) * 4);}
.mt-2{margin-top:calc(var(--spacing) * 2);}
.mt-4{margin-top:calc(var(--spacing) * 4);}
.p-3{padding:calc(var(--spacing) * 3);}
.py-2{padding-block:calc(var(--spacing) * 2);}
.py-4{padding-block:calc(var(--spacing) * 4);}
.py-6{padding-block:calc(var(--spacing) * 6);}
.pb-1{padding-bottom:calc(var(--spacing) * 1);}
.pb-2{padding-bottom:calc(var(--spacing) * 2);}
.pt-4{padding-top:calc(var(--spacing) * 4);}
.text-center{text-align:center;}
.text-start{text-align:start;}
.focus\\:outline-success:focus{outline-color:color-mix(in srgb, var(--colors-success) var(--srwc-outline-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.border{border-width:1px;}
.border-b{border-bottom-width:1px;}
.border-t{border-top-width:1px;}
.border-base-200{border-color:color-mix(in srgb, var(--colors-base-200) var(--srwc-border-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
.hover\\:border-success:hover{border-color:color-mix(in srgb, var(--colors-success) var(--srwc-border-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.rounded-full{border-radius:calc(infinity * 1px);}
.rounded-sm{border-radius:var(--radius-sm);}
.bg-base-100{background-color:color-mix(in srgb, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.bg-base-200{background-color:color-mix(in srgb, var(--colors-base-200) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
.bg-base-content{background-color:color-mix(in srgb, var(--colors-base-content) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-content, oklch(0.28 0.0296 256.85)) */;}
.bg-success{background-color:color-mix(in srgb, var(--colors-success) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.hover\\:bg-success:hover{background-color:color-mix(in srgb, var(--colors-success) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.flex{display:flex;}
.flex-shrink-0{flex-shrink:0;}
.flex-col{flex-direction:column;}
.gap-1{gap:calc(var(--spacing) * 1);}
.gap-2{gap:calc(var(--spacing) * 2);}
.gap-3{gap:calc(var(--spacing) * 3);}
.gap-6{gap:calc(var(--spacing) * 6);}
.gap-8{gap:calc(var(--spacing) * 8);}
.h-2{height:calc(var(--spacing) * 2);}
.h-5{height:calc(var(--spacing) * 5);}
.h-6{height:calc(var(--spacing) * 6);}
.min-h-\\[52px\\]{min-height:52px;}
.min-w-86{min-width:calc(var(--spacing) * 86);}
.w-\\[11\\.66\\%\\]{width:11.66%;}
.w-\\[15\\%\\]{width:15%;}
.w-1\\/12{width:8.3333333333%;}
.w-1\\/6{width:16.6666666667%;}
.w-15{width:calc(var(--spacing) * 15);}
.w-2{width:calc(var(--spacing) * 2);}
.w-2\\/6{width:33.3333333333%;}
.w-5{width:calc(var(--spacing) * 5);}
.w-6{width:calc(var(--spacing) * 6);}
.w-full{width:100%;}
.block{display:block;}
.hidden,
[hidden=""]{display:none;}
.capitalize{text-transform:capitalize;}
.items-center{align-items:center;}
.top-0{top:calc(var(--spacing) * 0);}
.justify-center{justify-content:center;}
.justify-between{justify-content:space-between;}
.sticky{position:sticky;}
.static{position:static;}
.z-10{z-index:10;}
@keyframes pulse{0%, 100% {opacity:1} 50% {opacity:.5}}
.animate-pulse{animation:pulse 2s cubic-bezier(0.4,0,.6,1) infinite;}
.filter{filter:var(--srwc-blur,) var(--srwc-brightness,) var(--srwc-contrast,) var(--srwc-grayscale,) var(--srwc-hue-rotate,) var(--srwc-invert,) var(--srwc-saturate,) var(--srwc-sepia,) var(--srwc-drop-shadow,);}
.border-separate{border-collapse:separate;}
.border-spacing-0{--srwc-border-spacing-x:calc(var(--spacing) * 0);--srwc-border-spacing-y:calc(var(--spacing) * 0);border-spacing:var(--srwc-border-spacing-x) var(--srwc-border-spacing-y);}
@supports (color: color-mix(in lab, red, red)){
.text-base-300{color:color-mix(in oklab, var(--colors-base-300) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-300, oklch(0.4 0.0154 237.02)) */;}
.hover\\:text-base-100:hover{color:color-mix(in oklab, var(--colors-base-100) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.hover\\:text-base-content:hover{color:color-mix(in oklab, var(--colors-base-content) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-content, oklch(0.28 0.0296 256.85)) */;}
.focus\\:outline-success:focus{outline-color:color-mix(in oklab, var(--colors-success) var(--srwc-outline-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.border-base-200{border-color:color-mix(in oklab, var(--colors-base-200) var(--srwc-border-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
.hover\\:border-success:hover{border-color:color-mix(in oklab, var(--colors-success) var(--srwc-border-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.bg-base-100{background-color:color-mix(in oklab, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.bg-base-200{background-color:color-mix(in oklab, var(--colors-base-200) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
.bg-base-content{background-color:color-mix(in oklab, var(--colors-base-content) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-content, oklch(0.28 0.0296 256.85)) */;}
.bg-success{background-color:color-mix(in oklab, var(--colors-success) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.hover\\:bg-success:hover{background-color:color-mix(in oklab, var(--colors-success) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
}
@media (min-width: 40rem){
.sm\\:flex-1{flex:1 1 0%;}
.sm\\:flex-row{flex-direction:row;}
.sm\\:w-1\\/4{width:25%;}
.sm\\:w-25{width:calc(var(--spacing) * 25);}
}
@media (min-width: 48rem){
.md\\:mb-0{margin-bottom:calc(var(--spacing) * 0);}
.md\\:flex-none{flex:none;}
.md\\:min-w-64{min-width:calc(var(--spacing) * 64);}
.md\\:w-25{width:calc(var(--spacing) * 25);}
.md\\:w-35{width:calc(var(--spacing) * 35);}
.md\\:hidden{display:none;}
.md\\:table-cell{display:table-cell;}
.md\\:table-row{display:table-row;}
}
@media (min-width: 64rem){
.lg\\:w-45{width:calc(var(--spacing) * 45);}
};
    `],b([(0,o.n)({type:String,reflect:!0})],p.prototype,"league",2),b([(0,o.n)({type:Array,reflect:!0})],p.prototype,"books",2),b([(0,o.n)({type:Number,reflect:!0,attribute:"sponsored-offer-index"})],p.prototype,"sponsoredOfferIndex",2),b([(0,s.r)()],p.prototype,"_betType",2),b([(0,s.r)()],p.prototype,"_oddsFormat",2),b([(0,s.r)()],p.prototype,"_hasSponsoredOfferSlot",2),b([(0,s.r)()],p.prototype,"_filterKey",2),b([(0,a.o)({slot:"sponsored-offer"})],p.prototype,"_sponsoredOfferNodes",2),p=b([(0,o.t)(`${o.P}-public-betting-trends`)],p);const u=e=>!e||e<75?o.E:o.x`<span class="w-2 h-2 bg-success block rounded-full"></span>`,m=()=>o.x`<div class="mt-4 border rounded-sm gap-8 py-6 flex flex-col p-3 m-1 border-base-200 animate-pulse">
    ${[1,2,3,4].map(((e,t)=>o.x` ${0!==t?o.x`<hr class="border-base-200" />`:o.E}
        <div class="flex gap-3 flex-col">
          <div class="flex gap-6 justify-between">
            <div class="flex gap-2">
              <div class="w-5 h-5 flex-shrink-0 rounded-full bg-base-200"></div>
              <div class="h-5 w-15 sm:w-25 md:w-35 bg-base-200 rounded-sm"></div>
            </div>
            <div class="w-15 md:w-25 lg:w-45 h-5 bg-base-200 rounded-sm"></div>
            <div class="w-15 md:w-25 lg:w-45 h-5 bg-base-200 rounded-sm"></div>
            <div class="w-15 md:w-25 lg:w-45 h-5 bg-base-200 rounded-sm"></div>
          </div>
          <div class="flex gap-6 justify-between">
            <div class="flex gap-2">
              <div class="w-5 h-5 flex-shrink-0 rounded-full bg-base-200"></div>
              <div class="h-5 w-15 sm:w-25 md:w-35 bg-base-200 rounded-sm"></div>
            </div>
            <div class="w-15 md:w-25 lg:w-45 h-5 bg-base-200 rounded-sm"></div>
            <div class="w-15 md:w-25 lg:w-45 h-5 bg-base-200 rounded-sm"></div>
            <div class="w-15 md:w-25 lg:w-45 h-5 bg-base-200 rounded-sm"></div>
          </div>
        </div>`))}
  </div>`}}]);