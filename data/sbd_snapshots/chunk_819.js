"use strict";(globalThis.webpackChunkswrc_plugin=globalThis.webpackChunkswrc_plugin||[]).push([[819],{907:(e,t,r)=>{r.d(t,{E:()=>o});const o={OPERATOR_CLICK:"operator_click",ODDS_FORMAT_CHANGE:"odds_format_change"}},464:(e,t,r)=>{r.d(t,{E:()=>i});var o=r(948),a=r(907);const i=(e,t,r,i)=>o.x`<a href="${t}" @click="${function(e){const o={event:a.E.OPERATOR_CLICK,href:t,context:{...r,element:this.localName}},i=new CustomEvent(a.E.OPERATOR_CLICK,{detail:o,bubbles:!0,composed:!0});e.currentTarget.dispatchEvent(i)}}" rel="nofollow" class="${i??o.E}">${e}</a>`},578:(e,t,r)=>{r.d(t,{o:()=>n,s:()=>b,t:()=>h});var o=r(948),a=r(689);const i=(e,t,r)=>(r.configurable=!0,r.enumerable=!0,Reflect.decorate&&"object"!=typeof t&&Object.defineProperty(e,t,r),r);function n(e){return(t,r)=>{const{slot:o,selector:a}=e??{},n="slot"+(o?`[name=${o}]`:":not([name])");return i(t,r,{get(){var t;const r=null==(t=this.renderRoot)?void 0:t.querySelector(n),o=(null==r?void 0:r.assignedElements(e))??[];return void 0===a?o:o.filter((e=>e.matches(a)))}})}}var s=Object.defineProperty,l=Object.getOwnPropertyDescriptor,c=(e,t,r,o)=>{for(var a,i=o>1?void 0:o?l(t,r):t,n=e.length-1;n>=0;n--)(a=e[n])&&(i=(o?a(t,r,i):a(i))||i);return o&&i&&s(t,r,i),i};let d=class extends o.a{constructor(){super(...arguments),this.options=[],this.selected="",this.callback=()=>{},this.labelMap={}}render(){return o.x`
      <div class="flex justify-around border-4 rounded-lg md:rounded-sm border-base-200 bg-base-200">
        ${this.options.map((({key:e,value:t})=>{var r;const a=(null==(r=this.labelMap)?void 0:r[t])??e,i=this.selected===t;return o.x`
            <button
              data-value="${t}"
              @click="${()=>this.callback(t)}"
              class="cursor-pointer flex-1 py-2 px-1 text-sm rounded-sm font-body-bold font-bold capitalize bg-base-100 ${i?"text-base-100 bg-base-300":"hover:bg-base-200"}">
              ${a}
            </button>
          `}))}
      </div>
    `}};d.styles=[o.g,o.i`
      /* layer: properties */
@supports ((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b)))){*, ::before, ::after, ::backdrop{--un-bg-opacity:100%;--un-border-opacity:100%;--un-border-spacing-x:0;--un-border-spacing-y:0;--un-content:"";--un-text-opacity:100%;--un-outline-opacity:100%;--un-space-x-reverse:0;--un-space-y-reverse:0;--un-translate-x:0;--un-translate-y:0;--un-translate-z:0;--un-scale-x:1;--un-scale-y:1;--un-scale-z:1;}}
@property --un-text-opacity{syntax:"<percentage>";inherits:false;initial-value:100%;}
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
.text-base-100{color:color-mix(in srgb, var(--colors-base-100) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.font-body-bold{font-family:var(--font-body-bold);}
.font-bold{--srwc-font-weight:var(--fontWeight-bold);font-weight:var(--fontWeight-bold);}
.px-1{padding-inline:calc(var(--spacing) * 1);}
.py-2{padding-block:calc(var(--spacing) * 2);}
.border-4{border-width:4px;}
.border-base-200{border-color:color-mix(in srgb, var(--colors-base-200) var(--srwc-border-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
.rounded-lg{border-radius:var(--radius-lg);}
.rounded-sm{border-radius:var(--radius-sm);}
.bg-base-100{background-color:color-mix(in srgb, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.bg-base-200{background-color:color-mix(in srgb, var(--colors-base-200) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
.bg-base-300{background-color:color-mix(in srgb, var(--colors-base-300) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-300, oklch(0.4 0.0154 237.02)) */;}
.hover\\:bg-base-200:hover{background-color:color-mix(in srgb, var(--colors-base-200) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
.flex{display:flex;}
.flex-1{flex:1 1 0%;}
.cursor-pointer{cursor:pointer;}
.capitalize{text-transform:capitalize;}
.justify-around{justify-content:space-around;}
.static{position:static;}
@supports (color: color-mix(in lab, red, red)){
.text-base-100{color:color-mix(in oklab, var(--colors-base-100) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.border-base-200{border-color:color-mix(in oklab, var(--colors-base-200) var(--srwc-border-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
.bg-base-100{background-color:color-mix(in oklab, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.bg-base-200{background-color:color-mix(in oklab, var(--colors-base-200) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
.bg-base-300{background-color:color-mix(in oklab, var(--colors-base-300) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-300, oklch(0.4 0.0154 237.02)) */;}
.hover\\:bg-base-200:hover{background-color:color-mix(in oklab, var(--colors-base-200) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
}
@media (min-width: 48rem){
.md\\:rounded-sm{border-radius:var(--radius-sm);}
};
    `],c([(0,o.n)({type:Array})],d.prototype,"options",2),c([(0,o.n)({type:String})],d.prototype,"selected",2),c([(0,o.n)({type:Function})],d.prototype,"callback",2),c([(0,o.n)({type:Object})],d.prototype,"labelMap",2),d=c([(0,o.t)(`${o.P}-group-select`)],d);const b="data:image/svg+xml,%3csvg%20preserveAspectRatio='xMidYMid%20meet'%20viewBox='0%200%2024%2024'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M13.623%2016.843c.089.09.179.179.29.268.045.045.09.09.157.135.112.09.224.156.359.224.045.022.112.067.179.09.134.066.269.134.403.178h.045c.067%200%20.112.045.18.068h.044c.134.044.291.09.426.134h.067c.067%200%20.112.022.179.045h.067c.067%200%20.157.022.224.045.067%200%20.157%200%20.224.022H17.587c.067%200%20.157%200%20.224-.022a.796.796%200%200%200%20.224-.045h.067c.067%200%20.112-.023.18-.045h.066c.157-.045.292-.067.426-.134h.045c.067%200%20.112-.045.179-.068h.045c.134-.044.268-.112.403-.179.067-.022.112-.067.18-.09.111-.067.245-.156.357-.223.045-.045.113-.09.157-.135.112-.09.202-.179.291-.268.359-.404.56-.852.56-1.344%200-1.479-1.769-2.666-3.964-2.666-2.195%200-3.965%201.187-3.965%202.666.046.918.202.963.56%201.344z'%20fill='currentColor'/%3e%3cpath%20d='M20.768%2017.671c-.03.03-.022.045-.044.09l-.068.067c-.022.022-.067.045-.112.09%200%200-.044.022-.067.044-.067.045-.112.09-.179.135-.873.604-2.038.918-3.27.918-1.232%200-2.374-.336-3.27-.918-.067-.045-.112-.09-.18-.135%200%200-.044-.022-.067-.045-.044-.022-.067-.044-.112-.09-.022%200-.044-.044-.067-.066-.022-.023-.067-.045-.09-.09l-.067-.067-.134-.134v.739c0%201.478%201.77%202.665%203.965%202.665s3.964-1.187%203.964-2.665v-.74l-.134.135-.068.067z'%20fill='currentColor'/%3e%3cg%20clip-path='url(%23obot0w6zxa)'%20fill='currentColor'%3e%3cpath%20d='M10.771%203.229c-.214-.214-1.286-.5-2.595-.357l2.953%202.952c.142-1.31-.143-2.38-.358-2.595zM3.2%2010.777c.238.239%201.404.477%202.81.262L2.913%207.944c-.215%201.405.047%202.595.262%202.81l.024.024zM7.033%203.086a6.017%206.017%200%200%200-2.476%201.476%206.006%206.006%200%200%200-1.358%202.286l3.93%203.93A6.006%206.006%200%200%200%209.413%209.42a5.77%205.77%200%200%200%201.477-2.476L7.033%203.086z'/%3e%3c/g%3e%3cg%20clip-path='url(%239daqxz9zdb)'%20fill='currentColor'%3e%3cpath%20d='M13.57%204.6a4.01%204.01%200%200%200-.713%201.93h1.539a3.845%203.845%200%200%200-.827-1.93zM15.244%206.53h1.309V2.832a4.28%204.28%200%200%200-2.434%201.125c.62.712%201.033%201.584%201.125%202.571zM21.19%206.53c-.068-.712-.344-1.378-.711-1.93a3.761%203.761%200%200%200-.827%201.93h1.538zM19.904%203.958a4.076%204.076%200%200%200-2.433-1.125V6.53h1.308a4.464%204.464%200%200%201%201.125-2.57zM20.455%209.376a4.01%204.01%200%200%200%20.712-1.928h-1.538c.092.734.39%201.377.826%201.928zM17.47%207.471v3.696a4.28%204.28%200%200%200%202.434-1.125c-.62-.712-1.033-1.584-1.125-2.571h-1.308zM12.834%207.471c.069.712.344%201.377.712%201.928a3.76%203.76%200%200%200%20.826-1.928h-1.538zM14.12%2010.042a4.076%204.076%200%200%200%202.433%201.125V7.471h-1.309a4.463%204.463%200%200%201-1.125%202.571z'/%3e%3c/g%3e%3cg%20clip-path='url(%23opswwgqn6c)'%20fill='currentColor'%3e%3cpath%20d='M10.417%2014.61a3.754%203.754%200%200%200%200%204.735%204.07%204.07%200%200%200%20.751-2.368c0-.888-.273-1.707-.751-2.368zM3.585%2014.61a4.07%204.07%200%200%200-.751%202.367c0%20.888.273%201.708.751%202.368a3.754%203.754%200%200%200%200-4.736z'/%3e%3cpath%20d='M9.869%2013.972a4.164%204.164%200%200%200-2.87-1.139%204.164%204.164%200%200%200-2.868%201.139A4.569%204.569%200%200%201%205.269%2017a4.613%204.613%200%200%201-1.138%203.028A4.164%204.164%200%200%200%207%2021.167a4.164%204.164%200%200%200%202.869-1.139A4.569%204.569%200%200%201%208.73%2017c0-1.161.433-2.209%201.139-3.028z'/%3e%3c/g%3e%3cdefs%3e%3cclipPath%20id='obot0w6zxa'%3e%3cpath%20fill='transparent'%20transform='translate(2%202)'%20d='M0%200h10v10H0z'/%3e%3c/clipPath%3e%3cclipPath%20id='9daqxz9zdb'%3e%3cpath%20fill='transparent'%20transform='translate(12%202)'%20d='M0%200h10v10H0z'/%3e%3c/clipPath%3e%3cclipPath%20id='opswwgqn6c'%3e%3cpath%20fill='transparent'%20transform='translate(2%2012)'%20d='M0%200h10v10H0z'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e";function h(e,t){return o.x`<img
    title="${e.market} ${e.name}"
    loading="lazy"
    src="${a.c.teamLogo(t,e.abbreviation)}"
    class="rounded-sm"
    width="24"
    height="24"
    alt="${e.market} ${e.name} logo" />`}},999:(e,t,r)=>{r.d(t,{r:()=>a});var o=r(948);function a(e){return(0,o.n)({...e,state:!0,attribute:!1})}}}]);