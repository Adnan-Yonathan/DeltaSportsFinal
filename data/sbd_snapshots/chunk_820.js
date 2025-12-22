"use strict";(globalThis.webpackChunkswrc_plugin=globalThis.webpackChunkswrc_plugin||[]).push([[820],{920:(e,t,r)=>{r.d(t,{b:()=>s});var o=r(948),i=r(637),a=r(271);const s="data:image/svg+xml,%3csvg%20preserveAspectRatio='xMidYMid%20meet'%20viewBox='0%200%2024%2024'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M2%207C2%204.23858%204.23858%202%207%202H17C19.7614%202%2022%204.23858%2022%207V17C22%2019.7614%2019.7614%2022%2017%2022H7C4.23858%2022%202%2019.7614%202%2017V7ZM7%204C5.34315%204%204%205.34315%204%207V17C4%2018.6569%205.34315%2020%207%2020H17C18.6569%2020%2020%2018.6569%2020%2017V7C20%205.34315%2018.6569%204%2017%204H7Z'%20fill='currentColor'/%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M16%2013C16.5523%2013%2017%2013.4477%2017%2014V16C17%2016.5523%2016.5523%2017%2016%2017C15.4477%2017%2015%2016.5523%2015%2016V14C15%2013.4477%2015.4477%2013%2016%2013Z'%20fill='currentColor'/%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M8%207C8.55228%207%209%207.44772%209%208V16C9%2016.5523%208.55228%2017%208%2017C7.44771%2017%207%2016.5523%207%2016V8C7%207.44772%207.44772%207%208%207Z'%20fill='currentColor'/%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M12%2010C12.5523%2010%2013%2010.4477%2013%2011V16C13%2016.5523%2012.5523%2017%2012%2017C11.4477%2017%2011%2016.5523%2011%2016V11C11%2010.4477%2011.4477%2010%2012%2010Z'%20fill='currentColor'/%3e%3c/svg%3e";Object.getOwnPropertyDescriptor;let n=class extends o.a{_closeDialog(){this.closest("dialog").close()}render(){return this.closest("dialog")?o.x`<form
        method="dialog"
        class="p-6 flex justify-center gap-4 flex-col relative z-20 bg-base-100 text-sm rounded-lg">
        <div class="flex justify-between items-center">
          <h4 class="text-xl black font-black font-body-black">Odds Comparison</h4>
          <button @click="${this._closeDialog}" aria-label="close dialog" class="cursor-pointer w-6 h-6" autofocus>
            ${(0,i.o)(a.s)}
          </button>
        </div>
        <slot name="body"></slot>
      </form>
      <form @click="${this._closeDialog}" method="dialog" class="flex fixed top-0 left-0 w-full h-full">
        <button class="flex-1">close</button>
      </form>`:o.E}};n.styles=[o.g,o.i`
      /* layer: properties */
@supports ((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b)))){*, ::before, ::after, ::backdrop{--un-bg-opacity:100%;--un-border-opacity:100%;--un-border-spacing-x:0;--un-border-spacing-y:0;--un-content:"";--un-text-opacity:100%;--un-outline-opacity:100%;--un-space-x-reverse:0;--un-space-y-reverse:0;--un-translate-x:0;--un-translate-y:0;--un-translate-z:0;--un-scale-x:1;--un-scale-y:1;--un-scale-z:1;}}
@property --un-bg-opacity{syntax:"<percentage>";inherits:false;initial-value:100%;}
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
--text-2xl-fontSize: 1.5rem;
--text-2xl-lineHeight: 2rem;
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
/* layer: default */
.text-sm{font-size:var(--text-sm-fontSize);line-height:var(--srwc-leading, var(--text-sm-lineHeight));}
.text-xl{font-size:var(--text-xl-fontSize);line-height:var(--srwc-leading, var(--text-xl-lineHeight));}
.font-black{--srwc-font-weight:var(--fontWeight-black);font-weight:var(--fontWeight-black);}
.font-body-black{font-family:var(--font-body-black);}
.p-6{padding:calc(var(--spacing) * 6);}
.rounded-lg{border-radius:var(--radius-lg);}
.bg-base-100{background-color:color-mix(in srgb, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.flex{display:flex;}
.flex-1{flex:1 1 0%;}
.flex-col{flex-direction:column;}
.gap-4{gap:calc(var(--spacing) * 4);}
.h-6{height:calc(var(--spacing) * 6);}
.h-full{height:100%;}
.w-6{width:calc(var(--spacing) * 6);}
.w-full{width:100%;}
.cursor-pointer{cursor:pointer;}
.items-center{align-items:center;}
.left-0{left:calc(var(--spacing) * 0);}
.top-0{top:calc(var(--spacing) * 0);}
.justify-center{justify-content:center;}
.justify-between{justify-content:space-between;}
.fixed{position:fixed;}
.relative{position:relative;}
.static{position:static;}
.z-20{z-index:20;}
@supports (color: color-mix(in lab, red, red)){
.bg-base-100{background-color:color-mix(in oklab, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
};
    `],n=((e,t)=>{for(var r,o=t,i=e.length-1;i>=0;i--)(r=e[i])&&(o=r(o)||o);return o})([(0,o.t)(`${o.P}-dialog-content`)],n)},907:(e,t,r)=>{r.d(t,{E:()=>o});const o={OPERATOR_CLICK:"operator_click",ODDS_FORMAT_CHANGE:"odds_format_change"}},464:(e,t,r)=>{r.d(t,{E:()=>a});var o=r(948),i=r(907);const a=(e,t,r,a)=>o.x`<a href="${t}" @click="${function(e){const o={event:i.E.OPERATOR_CLICK,href:t,context:{...r,element:this.localName}},a=new CustomEvent(i.E.OPERATOR_CLICK,{detail:o,bubbles:!0,composed:!0});e.currentTarget.dispatchEvent(a)}}" rel="nofollow" class="${a??o.E}">${e}</a>`},271:(e,t,r)=>{r.d(t,{s:()=>o});const o='<svg preserveAspectRatio="xMidYMid meet" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">\n<path d="M0 4a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4z" fill="transparent"/>\n<rect x="23.424" y="10.697" width="18" height="3" rx="1" transform="rotate(135 23.424 10.697)" fill="currentColor"/>\n<rect x="21.303" y="23.425" width="18" height="3" rx="1" transform="rotate(-135 21.303 23.425)" fill="currentColor"/>\n</svg>'},652:(e,t,r)=>{r.d(t,{s:()=>o});const o='<svg preserveAspectRatio="xMidYMid meet" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n    <path d="M22.1 16.64 15.093 4.504c-1.144-2.005-4.038-2.005-5.179 0L2.904 16.64c-1.145 2.005.28 4.496 2.589 4.496h13.993c2.31 0 3.759-2.516 2.614-4.496zm-9.6 1.803c-.61 0-1.116-.506-1.116-1.115 0-.61.506-1.116 1.116-1.116.609 0 1.115.506 1.09 1.144.03.58-.506 1.087-1.09 1.087zm1.017-7.212c-.05.864-.103 1.725-.153 2.59-.024.279-.024.534-.024.81a.84.84 0 0 1-.84.811.822.822 0 0 1-.84-.786c-.074-1.346-.152-2.668-.226-4.014-.025-.354-.05-.712-.079-1.066 0-.585.33-1.067.865-1.219a1.12 1.12 0 0 1 1.297.634c.078.177.103.354.103.56-.025.564-.079 1.124-.103 1.68z" fill="currentColor"/>\n</svg>\n'},820:(e,t,r)=>{r.r(t),r.d(t,{FuturesTable:()=>p});var o=r(948),i=r(999),a=r(464),s=r(920),n=r(689),l=r(652),c=r(637),d=Object.defineProperty,b=Object.getOwnPropertyDescriptor,u=(e,t,r,o)=>{for(var i,a=o>1?void 0:o?b(t,r):t,s=e.length-1;s>=0;s--)(i=e[s])&&(a=(o?i(t,r,a):i(a))||a);return o&&a&&d(t,r,a),a};let p=class extends o.a{constructor(){super(...arguments),this.limit=null,this._compareDialogCompetitorId=null,this._bookClickUrlMap=new Map,this._fetchMarketsTask=new n.h(this,{task:async([e,t,r],{signal:i})=>{var a,s;if(!(0,n.i)(e))throw new Error(o.b.INVALID_LEAGUE);const l=null==(a=null==t?void 0:t.map((e=>e.id)))?void 0:a.filter(Boolean);if(null==l||!l.length)throw new Error(o.b.ODDS_NOT_AVAILABLE);const c=await fetch((0,n.m)(e,l,r),{signal:i});if(!c.ok)throw new Error(`Failed to fetch markets: ${c.status} ${c.statusText}`);const d=await c.json();if((null==(s=null==d?void 0:d.data)?void 0:s.length)>0)return d;throw Error(o.b.ODDS_NOT_AVAILABLE)},args:()=>[this.league,this.books,this.event]}),this._renderPendingTableRows=()=>{const e=this.limit>0?this.limit:8;return o.x`
      ${[...Array(e)].map((()=>o.x`<tr class="animate-pulse [&>td]:first:pt-2">
          <td>
            <div class="items-center flex text-left gap-2 mr-1">
              <div class="rounded-sm bg-base-200 w-6 h-6"></div>
              <div class="bg-base-200 h-4 w-12 rounded-sm"></div>
            </div>
          </td>
          <td class="py-0.5 z-10 relative bg-base-100">
            <div
              class="bg-base-200 items-center mr-1 flex flex-1 mx-auto align-center h-[52px] z-20 relative py-2 px-4 justify-center border border-base-200 rounded-sm"></div>
          </td>
          <td class="py-0.5 z-10 relative bg-base-100">
            <div
              class="bg-base-200 items-center mr-1 flex flex-1 mx-auto align-center h-[52px] z-20 relative py-2 px-4 justify-center border border-base-200 rounded-sm">
              <div class="flex gap-2 items-center"></div>
            </div>
          </td>
          <td>
            <div class="bg-base-200 relative px-0.5 flex mx-auto w-6 h-6 rounded-sm"></div>
          </td>
        </tr>`))}
    `}}_renderTableHead(){return o.x`
      <thead class="sticky top-0 z-30">
        <tr class="bg-base-100 font-bold font-body-bold">
          <th class="py-4 border-b border-base-200"></th>
          <th class="py-4 border-b border-base-200 md:w-56">Open</th>
          <th class="py-4 border-b border-base-200 md:w-56">Best</th>
          <th class="py-4 border-b border-base-200 w-16">Compare</th>
        </tr>
      </thead>
    `}_getCompetitorData(e){var t,r,o,i;return{name:(null==e?void 0:e.competitor_name)||"",teamAbbreviation:(null==e?void 0:e.abbr)||(null==(t=null==e?void 0:e.team)?void 0:t.abbr)||(null==e?void 0:e.alias)||(null==(r=null==e?void 0:e.team)?void 0:r.alias)||"",team:(null==(o=null==e?void 0:e.team)?void 0:o.name)||"",market:(null==(i=null==e?void 0:e.team)?void 0:i.market)||""}}_getCompetitorAlt(e,t){return"competitor"===e?t.name:`${t.market} ${t.team}`}_renderTeamLogo(e,t){return t?o.x`<img
      onerror="${'this.style="visibility:hidden"'}"
      title="${e}"
      loading="lazy"
      src="${n.c.teamLogo(this.league,t)}"
      class="rounded-sm"
      width="24"
      height="24"
      alt="${e}" />`:o.E}_renderCompetitorInfo(e){const t=h(e),r=this._getCompetitorData(e),i=this._getCompetitorAlt(t,r),a=this._renderTeamLogo(i,r.teamAbbreviation);return"player"===t?o.x`<div
        class="flex-col items-start my-3 flex text-left font-bold font-body-bold gap-2 mr-1 min-h-[52px] justify-around">
        ${a} ${r.name}
      </div>`:o.x`<div class="items-center flex text-left font-bold font-body-bold gap-2 mr-1">
      ${a} ${r.teamAbbreviation}
    </div>`}_renderOpeningOddsCell(e){return o.x`<div
      class="bg-base-200 items-center mr-1 flex flex-1 mx-auto align-center h-[52px] z-20 relative bg-base-100 py-2 px-4 justify-center border border-base-200 rounded-sm">
      ${(null==e?void 0:e.open_odds_american)||o.N}
    </div>`}_renderBestOddsCell(e,t=!1,r=!1){const i=(null==e?void 0:e.odds_american)||o.N,s=t?o.x`<div class="flex gap-2 items-center">
          <img
            onerror="${'this.style="visibility:hidden"'}"
            width="24"
            height="24"
            title="${null==e?void 0:e.name}"
            class="rounded-full"
            src="${n.c.partnerLogo(null==e?void 0:e.name)}"
            alt="${null==e?void 0:e.name}" />
          ${i}
        </div>`:o.x`<div class="flex gap-2 items-center">${i}</div>`,l=this._getClickUrl(null==e?void 0:e.id),c={operator:null==e?void 0:e.name};return(0,a.E)(s,l,c,"flex flex-1 mx-auto align-center h-[52px] z-20 relative bg-base-100 p-2 justify-center border border-base-200 rounded-sm hover:border-success hover:bg-success transition-colors focus:outline-none hover:text-base-100"+(r?" border-success":""))}willUpdate(e){e.has("books")&&(this._bookClickUrlMap.clear(),(this.books||[]).forEach((e=>this._bookClickUrlMap.set(e.id,e.clickUrl))))}_getClickUrl(e){return e&&this._bookClickUrlMap.get(e)||"/"}_renderCompareOddsButton(e){return o.x`<button
      aria-label="open compare odds dialog"
      title="Compare Odds"
      data-id="${e}"
      @click="${this._handleCompareOdds}"
      class="bg-base-100 relative px-0.5 cursor-pointer flex mx-auto ${"after:content-[''] after:absolute after:h-0.5 after:w-4 after:inset-y-0 after:my-auto after:bg-base-200 after:right-full"}">
      <span style="mask: var(--ico-bar-chart-svg);" class="w-6 h-6 bg-primary"></span>
    </button>`}_renderTableRow(e){var t;const r=null==(t=null==e?void 0:e.odds)?void 0:t.find((e=>e.best)),i=this._renderCompetitorInfo(e),a=this._renderOpeningOddsCell(r),s=this._renderBestOddsCell(r,!0),n=this._renderCompareOddsButton(e.competitor_id),l=h(e);return"player"===l?o.x`
        <tr>
          <td class="border-b border-base-200">${i}</td>
          <td class="py-0.5 z-10 relative bg-base-100 border-b border-base-200 overflow-hidden">
            ${a}
          </td>
          <td class="py-0.5 z-10 relative bg-base-100 border-b border-base-200 overflow-hidden">${s}</td>
          <td class="border-b border-base-200">${n}</td>
        </tr>
      `:"competitor"===l?o.x`
        <tr class="[&>td]:first:pt-2">
          <td>${i}</td>
          <td class="py-0.5 z-10 relative bg-base-100 overflow-hidden">${a}</td>
          <td class="py-0.5 z-10 relative bg-base-100 overflow-hidden">${s}</td>
          <td>${n}</td>
        </tr>
      `:o.E}_handleCompareOdds(e){var t;const r=e.target,o=this.renderRoot.querySelector("#compare-odds-dialog"),i=null==(t=null==r?void 0:r.closest("button"))?void 0:t.getAttribute("data-id");o&&i&&(document.startViewTransition?document.startViewTransition((()=>o.showModal())):o.showModal(),this._compareDialogCompetitorId=i)}_renderCompareOddsDialogContent(){var e;if(!this._compareDialogCompetitorId)return o.E;const t=this._fetchMarketsTask.value.data.find((e=>e.competitor_id===this._compareDialogCompetitorId)),r=h(t),i=this._getCompetitorData(t),a=this._getCompetitorAlt(r,i),s=this._renderTeamLogo(a,i.teamAbbreviation);return o.x`<srwc-dialog-content>
      <div slot="body">
        <div class="items-center mb-4 flex font-bold font-body-bold gap-2 mr-1">
          ${s} ${t.competitor_name}
        </div>
        <table class="table-fixed font-normal w-full text-center">
          <tbody>
            ${null==(e=null==t?void 0:t.odds)?void 0:e.map((e=>{const t=null==e?void 0:e.best,r=this._renderBestOddsCell(e,!1,t);return o.x`<tr class="[&>td]:last:pb-4">
                <td class="pb-2">
                  <div class="flex gap-4 items-center">
                    <img
                      onerror="${'this.style="visibility:hidden"'}"
                      title="${e.name}"
                      loading="lazy"
                      src="${n.c.partnerLogo(e.name)}"
                      class="rounded-full mx-auto"
                      width="24"
                      height="24"
                      alt="${e.name}" />
                    ${r}
                  </div>
                </td>
              </tr>`}))}
          </tbody>
        </table>
        <p class="gap-2 flex items-center font-bold font-body-bold">
          <span class="size-2 bg-success block rounded-full"></span>
          Best Odds
        </p>
      </div>
    </srwc-dialog-content>`}_renderErrorTableRow(e){return console.warn(`${this.tagName}:`,e.message),o.x`<tr>
      <td colspan="4" class="text-center py-6 text-base">
        <div class="flex gap-2 flex-col items-center">
          <span class="size-6 block">${(0,c.o)(l.s)}</span>
          ${o.b.ODDS_NOT_AVAILABLE}
        </div>
      </td>
    </tr>`}render(){return o.x`
      <div global-css>
        <table class="text-sm w-full table-fixed text-center border-separate border-spacing-0 max-w-4xl min-w-xs">
          ${this._renderTableHead()}
          <tbody>
            ${this._fetchMarketsTask.render({pending:this._renderPendingTableRows,initial:this._renderPendingTableRows,error:e=>this._renderErrorTableRow(e),complete:({data:e})=>("number"==typeof this.limit&&this.limit>0&&(e=e.slice(0,this.limit)),e.map((e=>this._renderTableRow(e))))})}
          </tbody>
        </table>
        <dialog
          class="p-0 w-[calc(100vw-2.5rem)] max-w-2xs m-auto shadow-xl rounded-lg backdrop:bg-base-content/25"
          id="compare-odds-dialog">
          ${this._renderCompareOddsDialogContent()}
        </dialog>
      </div>
    `}};function h(e){var t,r;return null!=(t=null==e?void 0:e.competitor_id)&&t.includes("competitor")?"competitor":null!=(r=null==e?void 0:e.competitor_id)&&r.includes("player")?"player":void 0}p.styles=[o.g,o.i`
      :host {
        ${(0,o.r)(`--ico-bar-chart-svg: url("${(0,o.r)(s.b)}") center/contain no-repeat;`)}
      }
      /* layer: properties */
@supports ((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b)))){*, ::before, ::after, ::backdrop{--un-bg-opacity:100%;--un-border-opacity:100%;--un-border-spacing-x:0;--un-border-spacing-y:0;--un-content:"";--un-text-opacity:100%;}}
@property --un-text-opacity{syntax:"<percentage>";inherits:false;initial-value:100%;}
@property --un-border-opacity{syntax:"<percentage>";inherits:false;initial-value:100%;}
@property --un-bg-opacity{syntax:"<percentage>";inherits:false;initial-value:100%;}
@property --un-content{syntax:"*";inherits:false;initial-value:"";}
@property --un-inset-ring-color{syntax:"*";inherits:false;}
@property --un-inset-ring-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000;}
@property --un-inset-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000;}
@property --un-inset-shadow-color{syntax:"*";inherits:false;}
@property --un-ring-color{syntax:"*";inherits:false;}
@property --un-ring-inset{syntax:"*";inherits:false;}
@property --un-ring-offset-color{syntax:"*";inherits:false;}
@property --un-ring-offset-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000;}
@property --un-ring-offset-width{syntax:"<length>";inherits:false;initial-value:0px;}
@property --un-ring-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000;}
@property --un-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000;}
@property --un-shadow-color{syntax:"*";inherits:false;}
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
[global-css=""]{color:color-mix(in srgb, var(--colors-base-content) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-content, oklch(0.28 0.0296 256.85)) */;font-family:var(--font-body);background-color:color-mix(in srgb, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
@supports (color: color-mix(in lab, red, red)){
[global-css=""]{background-color:color-mix(in oklab, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
[global-css=""]{color:color-mix(in oklab, var(--colors-base-content) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-content, oklch(0.28 0.0296 256.85)) */;}
}
/* layer: default */
.text-base{font-size:var(--text-base-fontSize);line-height:var(--srwc-leading, var(--text-base-lineHeight));}
.text-sm{font-size:var(--text-sm-fontSize);line-height:var(--srwc-leading, var(--text-sm-lineHeight));}
.hover\\:text-base-100:hover{color:color-mix(in srgb, var(--colors-base-100) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.font-body-bold{font-family:var(--font-body-bold);}
.font-bold{--srwc-font-weight:var(--fontWeight-bold);font-weight:var(--fontWeight-bold);}
.font-normal{--srwc-font-weight:var(--fontWeight-normal);font-weight:var(--fontWeight-normal);}
.m-auto{margin:auto;}
.mx-auto{margin-inline:auto;}
.my-3{margin-block:calc(var(--spacing) * 3);}
.after\\:my-auto::after{margin-block:auto;}
.mb-4{margin-bottom:calc(var(--spacing) * 4);}
.mr-1{margin-right:calc(var(--spacing) * 1);}
.p-0{padding:calc(var(--spacing) * 0);}
.p-2{padding:calc(var(--spacing) * 2);}
.px-0\\.5{padding-inline:calc(var(--spacing) * 0.5);}
.px-4{padding-inline:calc(var(--spacing) * 4);}
.py-0\\.5{padding-block:calc(var(--spacing) * 0.5);}
.py-2{padding-block:calc(var(--spacing) * 2);}
.py-4{padding-block:calc(var(--spacing) * 4);}
.py-6{padding-block:calc(var(--spacing) * 6);}
.pb-2{padding-bottom:calc(var(--spacing) * 2);}
.\\[\\&\\>td\\]\\:first\\:pt-2:first-child>td{padding-top:calc(var(--spacing) * 2);}
.\\[\\&\\>td\\]\\:last\\:pb-4:last-child>td{padding-bottom:calc(var(--spacing) * 4);}
.text-center{text-align:center;}
.text-left{text-align:left;}
.focus\\:outline-none:focus{--srwc-outline-style:none;outline-style:none;}
.border{border-width:1px;}
.border-b{border-bottom-width:1px;}
.border-base-200{border-color:color-mix(in srgb, var(--colors-base-200) var(--srwc-border-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
.border-success{border-color:color-mix(in srgb, var(--colors-success) var(--srwc-border-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.hover\\:border-success:hover{border-color:color-mix(in srgb, var(--colors-success) var(--srwc-border-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.rounded-full{border-radius:calc(infinity * 1px);}
.rounded-lg{border-radius:var(--radius-lg);}
.rounded-sm{border-radius:var(--radius-sm);}
.backdrop\\:bg-base-content\\/25::backdrop{background-color:color-mix(in srgb, var(--colors-base-content) 25%, transparent) /* var(--srwc-color-base-content, oklch(0.28 0.0296 256.85)) */;}
.bg-base-100{background-color:color-mix(in srgb, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.bg-base-200{background-color:color-mix(in srgb, var(--colors-base-200) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
.bg-primary{background-color:color-mix(in srgb, var(--colors-primary) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-primary, oklch(45% .24 277.023)) */;}
.bg-success{background-color:color-mix(in srgb, var(--colors-success) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.hover\\:bg-success:hover{background-color:color-mix(in srgb, var(--colors-success) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.after\\:bg-base-200::after{background-color:color-mix(in srgb, var(--colors-base-200) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
.flex{display:flex;}
.flex-1{flex:1 1 0%;}
.flex-col{flex-direction:column;}
.gap-2{gap:calc(var(--spacing) * 2);}
.gap-4{gap:calc(var(--spacing) * 4);}
.size-2{width:calc(var(--spacing) * 2);height:calc(var(--spacing) * 2);}
.size-6{width:calc(var(--spacing) * 6);height:calc(var(--spacing) * 6);}
.h-\\[52px\\]{height:52px;}
.h-4{height:calc(var(--spacing) * 4);}
.h-6{height:calc(var(--spacing) * 6);}
.max-w-2xs{max-width:var(--container-2xs);}
.max-w-4xl{max-width:var(--container-4xl);}
.min-h-\\[52px\\]{min-height:52px;}
.min-w-xs{min-width:var(--container-xs);}
.w-\\[calc\\(100vw-2\\.5rem\\)\\]{width:calc(100vw - 2.5rem);}
.w-12{width:calc(var(--spacing) * 12);}
.w-16{width:calc(var(--spacing) * 16);}
.w-6{width:calc(var(--spacing) * 6);}
.w-full{width:100%;}
.after\\:h-0\\.5::after{height:calc(var(--spacing) * 0.5);}
.after\\:w-4::after{width:calc(var(--spacing) * 4);}
.block{display:block;}
.cursor-pointer{cursor:pointer;}
.after\\:content-\\[\\'\\'\\]::after{--srwc-content:'';content:var(--srwc-content);}
.shadow-xl{--srwc-shadow:0 20px 25px -5px var(--srwc-shadow-color, rgb(0 0 0 / 0.1)),0 8px 10px -6px var(--srwc-shadow-color, rgb(0 0 0 / 0.1));box-shadow:var(--srwc-inset-shadow), var(--srwc-inset-ring-shadow), var(--srwc-ring-offset-shadow), var(--srwc-ring-shadow), var(--srwc-shadow);}
.transition-colors{transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,--un-gradient-from,--un-gradient-via,--un-gradient-to;transition-timing-function:var(--srwc-ease, var(--default-transition-timingFunction));transition-duration:var(--srwc-duration, var(--default-transition-duration));}
.items-start{align-items:flex-start;}
.items-center{align-items:center;}
.after\\:inset-y-0::after{inset-block:calc(var(--spacing) * 0);}
.top-0{top:calc(var(--spacing) * 0);}
.after\\:right-full::after{right:100%;}
.justify-center{justify-content:center;}
.justify-around{justify-content:space-around;}
.relative{position:relative;}
.sticky{position:sticky;}
.after\\:absolute::after{position:absolute;}
.static{position:static;}
.z-10{z-index:10;}
.z-20{z-index:20;}
.z-30{z-index:30;}
.overflow-hidden{overflow:hidden;}
@keyframes pulse{0%, 100% {opacity:1} 50% {opacity:.5}}
.animate-pulse{animation:pulse 2s cubic-bezier(0.4,0,.6,1) infinite;}
.border-separate{border-collapse:separate;}
.border-spacing-0{--srwc-border-spacing-x:calc(var(--spacing) * 0);--srwc-border-spacing-y:calc(var(--spacing) * 0);border-spacing:var(--srwc-border-spacing-x) var(--srwc-border-spacing-y);}
.table-fixed{table-layout:fixed;}
@supports (color: color-mix(in lab, red, red)){
.hover\\:text-base-100:hover{color:color-mix(in oklab, var(--colors-base-100) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.border-base-200{border-color:color-mix(in oklab, var(--colors-base-200) var(--srwc-border-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
.border-success{border-color:color-mix(in oklab, var(--colors-success) var(--srwc-border-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.hover\\:border-success:hover{border-color:color-mix(in oklab, var(--colors-success) var(--srwc-border-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.backdrop\\:bg-base-content\\/25::backdrop{background-color:color-mix(in oklab, var(--colors-base-content) 25%, transparent) /* var(--srwc-color-base-content, oklch(0.28 0.0296 256.85)) */;}
.bg-base-100{background-color:color-mix(in oklab, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.bg-base-200{background-color:color-mix(in oklab, var(--colors-base-200) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
.bg-primary{background-color:color-mix(in oklab, var(--colors-primary) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-primary, oklch(45% .24 277.023)) */;}
.bg-success{background-color:color-mix(in oklab, var(--colors-success) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.hover\\:bg-success:hover{background-color:color-mix(in oklab, var(--colors-success) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.after\\:bg-base-200::after{background-color:color-mix(in oklab, var(--colors-base-200) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
}
@media (min-width: 48rem){
.md\\:w-56{width:calc(var(--spacing) * 56);}
};
    `],u([(0,o.n)({type:String,reflect:!0})],p.prototype,"league",2),u([(0,o.n)({type:Array,reflect:!0})],p.prototype,"books",2),u([(0,o.n)({type:String,reflect:!0})],p.prototype,"event",2),u([(0,o.n)({type:Number,reflect:!0})],p.prototype,"limit",2),u([(0,i.r)()],p.prototype,"_compareDialogCompetitorId",2),p=u([(0,o.t)(`${o.P}-futures-table`)],p)},999:(e,t,r)=>{r.d(t,{r:()=>i});var o=r(948);function i(e){return(0,o.n)({...e,state:!0,attribute:!1})}},637:(e,t,r)=>{r.d(t,{e:()=>a,i:()=>s,o:()=>c,t:()=>i});var o=r(948);const i={CHILD:2},a=e=>(...t)=>({_$litDirective$:e,values:t});class s{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,t,r){this._$Ct=e,this._$AM=t,this._$Ci=r}_$AS(e,t){return this.update(e,t)}update(e,t){return this.render(...t)}}class n extends s{constructor(e){if(super(e),this.it=o.E,e.type!==i.CHILD)throw Error(this.constructor.directiveName+"() can only be used in child bindings")}render(e){if(e===o.E||null==e)return this._t=void 0,this.it=e;if(e===o.T)return e;if("string"!=typeof e)throw Error(this.constructor.directiveName+"() called with a non-string value");if(e===this.it)return this._t;this.it=e;const t=[e];return t.raw=t,this._t={_$litType$:this.constructor.resultType,strings:t,values:[]}}}n.directiveName="unsafeHTML",n.resultType=1;class l extends n{}l.directiveName="unsafeSVG",l.resultType=2;const c=a(l)}}]);