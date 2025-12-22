"use strict";(globalThis.webpackChunkswrc_plugin=globalThis.webpackChunkswrc_plugin||[]).push([[606],{606:(e,t,r)=>{r.d(t,{o:()=>h,s:()=>f});var o=r(948),i=r(637);const{I:n}=o.Z,s=()=>document.createComment(""),a=(e,t,r)=>{var o;const i=e._$AA.parentNode,a=void 0===t?e._$AB:t._$AA;if(void 0===r){const t=i.insertBefore(s(),a),o=i.insertBefore(s(),a);r=new n(t,o,e,e.options)}else{const t=r._$AB.nextSibling,n=r._$AM,s=n!==e;if(s){let t;null==(o=r._$AQ)||o.call(r,e),r._$AM=e,void 0!==r._$AP&&(t=e._$AU)!==n._$AU&&r._$AP(t)}if(t!==a||s){let e=r._$AA;for(;e!==t;){const t=e.nextSibling;i.insertBefore(e,a),e=t}}}return r},l=(e,t,r=e)=>(e._$AI(t,r),e),d={},c=e=>{var t;null==(t=e._$AP)||t.call(e,!1,!0);let r=e._$AA;const o=e._$AB.nextSibling;for(;r!==o;){const e=r.nextSibling;r.remove(),r=e}},u=(e,t,r)=>{const o=new Map;for(let i=t;i<=r;i++)o.set(e[i],i);return o},b=(0,i.e)(class extends i.i{constructor(e){if(super(e),e.type!==i.t.CHILD)throw Error("repeat() can only be used in text expressions")}dt(e,t,r){let o;void 0===r?r=t:void 0!==t&&(o=t);const i=[],n=[];let s=0;for(const t of e)i[s]=o?o(t,s):s,n[s]=r(t,s),s++;return{values:n,keys:i}}render(e,t,r){return this.dt(e,t,r).values}update(e,[t,r,i]){const n=(e=>e._$AH)(e),{values:s,keys:b}=this.dt(t,r,i);if(!Array.isArray(n))return this.ut=b,s;const h=this.ut??(this.ut=[]),f=[];let p,m,g=0,v=n.length-1,y=0,w=s.length-1;for(;g<=v&&y<=w;)if(null===n[g])g++;else if(null===n[v])v--;else if(h[g]===b[y])f[y]=l(n[g],s[y]),g++,y++;else if(h[v]===b[w])f[w]=l(n[v],s[w]),v--,w--;else if(h[g]===b[w])f[w]=l(n[g],s[w]),a(e,f[w+1],n[g]),g++,w--;else if(h[v]===b[y])f[y]=l(n[v],s[y]),a(e,n[g],n[v]),v--,y++;else if(void 0===p&&(p=u(b,y,w),m=u(h,g,v)),p.has(h[g]))if(p.has(h[v])){const t=m.get(b[y]),r=void 0!==t?n[t]:null;if(null===r){const t=a(e,n[g]);l(t,s[y]),f[y]=t}else f[y]=l(r,s[y]),a(e,n[g],r),n[t]=null;y++}else c(n[v]),v--;else c(n[g]),g++;for(;y<=w;){const t=a(e,f[w+1]);l(t,s[y]),f[y++]=t}for(;g<=v;){const e=n[g++];null!==e&&c(e)}return this.ut=b,((e,t=d)=>{e._$AH=t})(e,f),o.T}}),h=e=>e??o.E,f='<svg viewBox="0 0 24 25" preserveAspectRatio="xMidYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg">\n    <path d="m6.292 11.861 8.07-8.07a.997.997 0 0 1 1.409 0l.941.942a.997.997 0 0 1 .002 1.408l-6.396 6.425 6.396 6.425a.996.996 0 0 1-.002 1.408l-.941.941a.997.997 0 0 1-1.41 0l-8.07-8.07a.997.997 0 0 1 0-1.409z" fill="currentColor"/>\n    <mask id="1ur3nkllfa" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="6" y="3" width="12" height="19">\n        <path d="m6.292 11.861 8.07-8.07a.997.997 0 0 1 1.409 0l.941.942a.997.997 0 0 1 .002 1.408l-6.396 6.425 6.396 6.425a.996.996 0 0 1-.002 1.408l-.941.941a.997.997 0 0 1-1.41 0l-8.07-8.07a.997.997 0 0 1 0-1.409z" fill="transparent"/>\n    </mask>\n</svg>\n';var p=Object.defineProperty,m=Object.getOwnPropertyDescriptor,g=(e,t,r,o)=>{for(var i,n=o>1?void 0:o?m(t,r):t,s=e.length-1;s>=0;s--)(i=e[s])&&(n=(o?i(t,r,n):i(n))||n);return o&&n&&p(t,r,n),n};let v=class extends o.a{constructor(){super(...arguments),this._id="",this.onChange=()=>{},this.selected="",this.disabled=!1,this.label=null,this.options=[]}_handleChange(e){e.target.blur(),this.onChange(e)}render(){return o.x`<div
      class="flex rounded-sm relative group overflow-hidden font-bold font-body-bold text-sm ${this.disabled?"pointer-events-none opacity-50":""}">
      <select
        aria-label=${h(this.label)}
        ?disabled=${this.disabled}
        id="${this._id}"
        @change="${this._handleChange}"
        class="cursor-pointer focus:outline-none focus:border-base-300 transition-colors bg-base-100 border border-base-200 w-full font-body-bold font-bold font-body-bold flex-1 peer appearance-none rounded-sm p-2 pr-7">
        ${b(this.options,(e=>e.value),(({value:e,label:t,classes:r})=>o.x`<option class="${r??o.E}" value="${e}" ?selected=${this.selected===e}>
              ${t}
            </option>`))}
      </select>
      <span
        class="pointer-events-none -rotate-90 transition-transform peer-focus:rotate-90 duration-300 z-10 right-3 absolute w-2.5 h-2.5 self-center">
        ${(0,i.o)(f)}
      </span>
    </div>`}};v.styles=[o.g,o.i`
      /* layer: properties */
@supports ((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b)))){*, ::before, ::after, ::backdrop{--un-bg-opacity:100%;--un-border-opacity:100%;--un-border-spacing-x:0;--un-border-spacing-y:0;--un-content:"";--un-text-opacity:100%;--un-outline-opacity:100%;--un-space-x-reverse:0;--un-space-y-reverse:0;--un-translate-x:0;--un-translate-y:0;--un-translate-z:0;--un-scale-x:1;--un-scale-y:1;--un-scale-z:1;}}
@property --un-border-opacity{syntax:"<percentage>";inherits:false;initial-value:100%;}
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
.font-body-bold{font-family:var(--font-body-bold);}
.font-bold{--srwc-font-weight:var(--fontWeight-bold);font-weight:var(--fontWeight-bold);}
.p-2{padding:calc(var(--spacing) * 2);}
.pr-7{padding-right:calc(var(--spacing) * 7);}
.appearance-none{-webkit-appearance:none;appearance:none;}
.focus\\:outline-none:focus{--srwc-outline-style:none;outline-style:none;}
.border{border-width:1px;}
.border-base-200{border-color:color-mix(in srgb, var(--colors-base-200) var(--srwc-border-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
.focus\\:border-base-300:focus{border-color:color-mix(in srgb, var(--colors-base-300) var(--srwc-border-opacity), transparent) /* var(--srwc-color-base-300, oklch(0.4 0.0154 237.02)) */;}
.rounded-sm{border-radius:var(--radius-sm);}
.bg-base-100{background-color:color-mix(in srgb, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.opacity-50{opacity:50%;}
.flex{display:flex;}
.flex-1{flex:1 1 0%;}
.h-2\\.5{height:calc(var(--spacing) * 2.5);}
.w-2\\.5{width:calc(var(--spacing) * 2.5);}
.w-full{width:100%;}
.cursor-pointer{cursor:pointer;}
.pointer-events-none{pointer-events:none;}
.-rotate-90{rotate:-90deg;}
.peer:focus~.peer-focus\\:rotate-90{rotate:90deg;}
.transition-colors{transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,--un-gradient-from,--un-gradient-via,--un-gradient-to;transition-timing-function:var(--srwc-ease, var(--default-transition-timingFunction));transition-duration:var(--srwc-duration, var(--default-transition-duration));}
.transition-transform{transition-property:transform,translate,scale,rotate;transition-timing-function:var(--srwc-ease, var(--default-transition-timingFunction));transition-duration:var(--srwc-duration, var(--default-transition-duration));}
.duration-300{--srwc-duration:300ms;transition-duration:300ms;}
.self-center{align-self:center;}
.right-3{right:calc(var(--spacing) * 3);}
.absolute{position:absolute;}
.relative{position:relative;}
.static{position:static;}
.z-10{z-index:10;}
.overflow-hidden{overflow:hidden;}
@supports (color: color-mix(in lab, red, red)){
.border-base-200{border-color:color-mix(in oklab, var(--colors-base-200) var(--srwc-border-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
.focus\\:border-base-300:focus{border-color:color-mix(in oklab, var(--colors-base-300) var(--srwc-border-opacity), transparent) /* var(--srwc-color-base-300, oklch(0.4 0.0154 237.02)) */;}
.bg-base-100{background-color:color-mix(in oklab, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
};
    `],g([(0,o.n)({type:String})],v.prototype,"_id",2),g([(0,o.n)({type:Function})],v.prototype,"onChange",2),g([(0,o.n)({type:String})],v.prototype,"selected",2),g([(0,o.n)({type:Boolean,reflect:!0})],v.prototype,"disabled",2),g([(0,o.n)({type:String,reflect:!0})],v.prototype,"label",2),g([(0,o.n)({type:Array})],v.prototype,"options",2),v=g([(0,o.t)(`${o.P}-select-dropdown`)],v)},637:(e,t,r)=>{r.d(t,{e:()=>n,i:()=>s,o:()=>d,t:()=>i});var o=r(948);const i={CHILD:2},n=e=>(...t)=>({_$litDirective$:e,values:t});class s{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,t,r){this._$Ct=e,this._$AM=t,this._$Ci=r}_$AS(e,t){return this.update(e,t)}update(e,t){return this.render(...t)}}class a extends s{constructor(e){if(super(e),this.it=o.E,e.type!==i.CHILD)throw Error(this.constructor.directiveName+"() can only be used in child bindings")}render(e){if(e===o.E||null==e)return this._t=void 0,this.it=e;if(e===o.T)return e;if("string"!=typeof e)throw Error(this.constructor.directiveName+"() called with a non-string value");if(e===this.it)return this._t;this.it=e;const t=[e];return t.raw=t,this._t={_$litType$:this.constructor.resultType,strings:t,values:[]}}}a.directiveName="unsafeHTML",a.resultType=1;class l extends a{}l.directiveName="unsafeSVG",l.resultType=2;const d=n(l)}}]);