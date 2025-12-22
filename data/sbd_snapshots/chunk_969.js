"use strict";(globalThis.webpackChunkswrc_plugin=globalThis.webpackChunkswrc_plugin||[]).push([[969],{920:(e,t,o)=>{o.d(t,{b:()=>s});var r=o(948),i=o(637),a=o(271);const s="data:image/svg+xml,%3csvg%20preserveAspectRatio='xMidYMid%20meet'%20viewBox='0%200%2024%2024'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M2%207C2%204.23858%204.23858%202%207%202H17C19.7614%202%2022%204.23858%2022%207V17C22%2019.7614%2019.7614%2022%2017%2022H7C4.23858%2022%202%2019.7614%202%2017V7ZM7%204C5.34315%204%204%205.34315%204%207V17C4%2018.6569%205.34315%2020%207%2020H17C18.6569%2020%2020%2018.6569%2020%2017V7C20%205.34315%2018.6569%204%2017%204H7Z'%20fill='currentColor'/%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M16%2013C16.5523%2013%2017%2013.4477%2017%2014V16C17%2016.5523%2016.5523%2017%2016%2017C15.4477%2017%2015%2016.5523%2015%2016V14C15%2013.4477%2015.4477%2013%2016%2013Z'%20fill='currentColor'/%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M8%207C8.55228%207%209%207.44772%209%208V16C9%2016.5523%208.55228%2017%208%2017C7.44771%2017%207%2016.5523%207%2016V8C7%207.44772%207.44772%207%208%207Z'%20fill='currentColor'/%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M12%2010C12.5523%2010%2013%2010.4477%2013%2011V16C13%2016.5523%2012.5523%2017%2012%2017C11.4477%2017%2011%2016.5523%2011%2016V11C11%2010.4477%2011.4477%2010%2012%2010Z'%20fill='currentColor'/%3e%3c/svg%3e";Object.getOwnPropertyDescriptor;let n=class extends r.a{_closeDialog(){this.closest("dialog").close()}render(){return this.closest("dialog")?r.x`<form
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
      </form>`:r.E}};n.styles=[r.g,r.i`
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
    `],n=((e,t)=>{for(var o,r=t,i=e.length-1;i>=0;i--)(o=e[i])&&(r=o(r)||r);return r})([(0,r.t)(`${r.P}-dialog-content`)],n)},907:(e,t,o)=>{o.d(t,{E:()=>r});const r={OPERATOR_CLICK:"operator_click",ODDS_FORMAT_CHANGE:"odds_format_change"}},464:(e,t,o)=>{o.d(t,{E:()=>a});var r=o(948),i=o(907);const a=(e,t,o,a)=>r.x`<a href="${t}" @click="${function(e){const r={event:i.E.OPERATOR_CLICK,href:t,context:{...o,element:this.localName}},a=new CustomEvent(i.E.OPERATOR_CLICK,{detail:r,bubbles:!0,composed:!0});e.currentTarget.dispatchEvent(a)}}" rel="nofollow" class="${a??r.E}">${e}</a>`},271:(e,t,o)=>{o.d(t,{s:()=>r});const r='<svg preserveAspectRatio="xMidYMid meet" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">\n<path d="M0 4a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4z" fill="transparent"/>\n<rect x="23.424" y="10.697" width="18" height="3" rx="1" transform="rotate(135 23.424 10.697)" fill="currentColor"/>\n<rect x="21.303" y="23.425" width="18" height="3" rx="1" transform="rotate(-135 21.303 23.425)" fill="currentColor"/>\n</svg>'},969:(e,t,o)=>{o.r(t),o.d(t,{PlayerProps:()=>z});var r=o(948),i=o(999),a=o(689),s=o(907),n=o(606),l=Object.defineProperty,c=Object.getOwnPropertyDescriptor,d=(e,t,o,r)=>{for(var i,a=r>1?void 0:r?c(t,o):t,s=e.length-1;s>=0;s--)(i=e[s])&&(a=(r?i(t,o,a):i(a))||a);return r&&a&&l(t,o,a),a};let u=class extends r.a{constructor(){super(...arguments),this.defaultFormat=r.O.AMERICAN,this.label="Odds Format",this.disabled=!1,this._selectedFormat=r.O.AMERICAN,this._oddsFormatOptions=[{label:r.O.AMERICAN,value:r.O.AMERICAN},{label:r.O.DECIMAL,value:r.O.DECIMAL},{label:r.O.FRACTIONAL,value:r.O.FRACTIONAL}],this._handleFormatChange=e=>{const t=e.target.value;this._selectedFormat=t;const o=new CustomEvent(s.E.ODDS_FORMAT_CHANGE,{detail:{oddsFormat:t},bubbles:!0,composed:!0});this.dispatchEvent(o)}}connectedCallback(){super.connectedCallback(),this._selectedFormat=this.defaultFormat}render(){return r.x`
      <div class="odds-format-selector">
        <srwc-select-dropdown
          .options=${this._oddsFormatOptions}
          .selected=${this._selectedFormat}
          .onChange=${this._handleFormatChange}
          .disabled=${this.disabled}
          .label=${this.label}></srwc-select-dropdown>
      </div>
    `}};u.styles=[r.g,r.i`
      /* layer: properties */
@supports ((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b)))){*, ::before, ::after, ::backdrop{--un-bg-opacity:100%;--un-border-opacity:100%;--un-border-spacing-x:0;--un-border-spacing-y:0;--un-content:"";--un-text-opacity:100%;--un-outline-opacity:100%;--un-space-x-reverse:0;--un-space-y-reverse:0;--un-translate-x:0;--un-translate-y:0;--un-translate-z:0;}}
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
/* layer: default */
.shadow{--srwc-shadow:0 1px 3px 0 var(--srwc-shadow-color, rgb(0 0 0 / 0.1)),0 1px 2px -1px var(--srwc-shadow-color, rgb(0 0 0 / 0.1));box-shadow:var(--srwc-inset-shadow), var(--srwc-inset-ring-shadow), var(--srwc-ring-offset-shadow), var(--srwc-ring-shadow), var(--srwc-shadow);}
.static{position:static;};
    `],d([(0,r.n)({type:String,reflect:!0,attribute:"default-format"})],u.prototype,"defaultFormat",2),d([(0,r.n)({type:String,reflect:!0})],u.prototype,"label",2),d([(0,r.n)({type:Boolean,reflect:!0})],u.prototype,"disabled",2),d([(0,i.r)()],u.prototype,"_selectedFormat",2),u=d([(0,r.t)(`${r.P}-odds-format`)],u);var h=o(920),b=o(655),p=o(464),m=o(637),f=Object.defineProperty,g=Object.getOwnPropertyDescriptor,v=(e,t,o,r)=>{for(var i,a=r>1?void 0:r?g(t,o):t,s=e.length-1;s>=0;s--)(i=e[s])&&(a=(r?i(t,o,a):i(a))||a);return r&&a&&f(t,o,a),a};let w=class extends r.a{render(){var e,t,o,i,s;return this.player&&this.league?r.x`<div class="relative self-start flex flex-shrink-0">
      <img
        title="${(0,n.o)(null==(e=this.player)?void 0:e.name)}"
        src="${a.c.playerHead(this.league,this.player.id)}"
        alt="${(0,n.o)(null==(t=this.player)?void 0:t.name)}"
        width="64"
        height="64"
        class="rounded-full bg-base-300 size-16"
        onerror="this.src='${a.c.playerHeadFallback()}'" />
      ${null!=(o=this.team)&&o.abbreviation?r.x`<img
            onerror="this.classList.add('hidden')"
            src="${a.c.teamLogo(this.league,this.team.abbreviation)}"
            width="24"
            height="24"
            title="${(0,n.o)(null==(i=this.team)?void 0:i.name)}"
            alt="${(0,n.o)(null==(s=this.team)?void 0:s.name)}"
            class="absolute z-10 size-6 bg-base-100 -end-1 -bottom-1 rounded-lg" />`:r.E}
    </div>`:r.E}};w.styles=[r.g,r.i`
      :host {
        display: flex;
      }
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
.rounded-full{border-radius:calc(infinity * 1px);}
.rounded-lg{border-radius:var(--radius-lg);}
.bg-base-100{background-color:color-mix(in srgb, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.bg-base-300{background-color:color-mix(in srgb, var(--colors-base-300) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-300, oklch(0.4 0.0154 237.02)) */;}
.flex{display:flex;}
.flex-shrink-0{flex-shrink:0;}
.size-16{width:calc(var(--spacing) * 16);height:calc(var(--spacing) * 16);}
.size-6{width:calc(var(--spacing) * 6);height:calc(var(--spacing) * 6);}
.hidden{display:none;}
.self-start{align-self:flex-start;}
.-end-1{inset-inline-end:calc(calc(var(--spacing) * 1) * -1);}
.-bottom-1{bottom:calc(calc(var(--spacing) * 1) * -1);}
.absolute{position:absolute;}
.relative{position:relative;}
.static{position:static;}
.z-10{z-index:10;}
@supports (color: color-mix(in lab, red, red)){
.bg-base-100{background-color:color-mix(in oklab, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.bg-base-300{background-color:color-mix(in oklab, var(--colors-base-300) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-300, oklch(0.4 0.0154 237.02)) */;}
};
    `],v([(0,r.n)({type:Object})],w.prototype,"player",2),v([(0,r.n)({type:Object})],w.prototype,"team",2),v([(0,r.n)({type:String})],w.prototype,"league",2),w=v([(0,r.t)(`${r.P}-player-headshot`)],w);var x=Object.defineProperty,y=Object.getOwnPropertyDescriptor,k=(e,t,o,r)=>{for(var i,a=r>1?void 0:r?y(t,o):t,s=e.length-1;s>=0;s--)(i=e[s])&&(a=(r?i(t,o,a):i(a))||a);return r&&a&&x(t,o,a),a};let z=class extends r.a{constructor(){super(...arguments),this.league=null,this.books=[],this.markets=null,this._oddsFormat=r.O.AMERICAN,this._compareDialogMarketIndex=null,this._searchFilter="",this._selectedMatchup="",this._currentLimit=0,this.fetchUpcomingGamesTask=new a.h(this,{task:async([e,t,o,i],{signal:s})=>{var n,l;if(!(0,a.i)(e))throw new Error(r.b.INVALID_LEAGUE);const c=(null==(n=null==t?void 0:t.map((e=>e.id)))?void 0:n.filter(Boolean))??[],d=await fetch((0,a.p)(e,c,o,i),{signal:s});if(!d.ok)throw new Error("Failed to fetch player props");const u=await d.json();if((null==(l=null==u?void 0:u.data)?void 0:l.length)>0)return u.data;throw new Error("No player props available.")},args:()=>[this.league,this.books,this._getEffectiveLimit(),this.markets]}),this._handleOddsFormatChange=e=>{const t=e.detail.oddsFormat;document.startViewTransition&&this._oddsFormat!==t?document.startViewTransition((()=>{this._oddsFormat=t})):this._oddsFormat=t},this._handleSearchInput=e=>{const t=e.target.value;document.startViewTransition&&this._searchFilter!==t?document.startViewTransition((()=>{this._searchFilter=t})):this._searchFilter=t},this._handleMatchupSelection=e=>{const t=e.target.value;document.startViewTransition&&this._selectedMatchup!==t?document.startViewTransition((()=>{this._selectedMatchup=t})):this._selectedMatchup=t},this._getUniqueMatchups=e=>{const t=new Set,o=[];return e.forEach((e=>{const{competition:r}=e,{competitors:i}=r||{};if(null!=i&&i.away&&null!=i&&i.home){const e=`${i.away.id}-${i.home.id}`,r=`${i.away.abbreviation} @ ${i.home.abbreviation}`;t.has(e)||(t.add(e),o.push({value:e,label:r,awayId:i.away.id,homeId:i.home.id}))}})),o},this._filterPlayerProps=e=>{let t=e;if(this._searchFilter.trim()){const e=this._searchFilter.toLowerCase().trim();t=t.filter((t=>{var o;const{player:r}=t;return null==(o=null==r?void 0:r.name)?void 0:o.toLowerCase().includes(e)}))}if(this._selectedMatchup){const[e,o]=this._selectedMatchup.split("-");t=t.filter((t=>{var r,i;const{player:a,competition:s}=t,{competitors:n}=s||{};return(null==(r=null==n?void 0:n.away)?void 0:r.id)===e&&(null==(i=null==n?void 0:n.home)?void 0:i.id)===o&&((null==a?void 0:a.competitor_id)===e||(null==a?void 0:a.competitor_id)===o)}))}return t},this._handleCompareOdds=e=>{var t;const o=e.target,r=this.renderRoot.querySelector("#player-props-compare-odds-dialog"),i=null==(t=null==o?void 0:o.closest("button"))?void 0:t.getAttribute("data-market-index");r&&i&&(document.startViewTransition?document.startViewTransition((()=>r.showModal())):r.showModal(),this._compareDialogMarketIndex=i)},this._handleLoadMore=()=>{const e=Number(this.limit)||10;document.startViewTransition?document.startViewTransition((()=>{this._currentLimit+=e})):this._currentLimit+=e},this._getEffectiveLimit=()=>null==this.limit?void 0:Number(this.limit)+this._currentLimit,this._renderComplete=e=>{if(!(null==e?void 0:e.some((e=>{var t;return null==(t=null==e?void 0:e.markets)?void 0:t.some((e=>{var t;return(null==(t=null==e?void 0:e.books)?void 0:t.length)>0}))}))))return this._renderError("No player props available for the selected books.");const t=[{label:"All Matchups",value:""},...this._getUniqueMatchups(e).map((e=>({label:e.label,value:e.value})))],o=this._filterPlayerProps(e),i=e.filter((e=>{var t;return(null==(t=null==e?void 0:e.markets)?void 0:t.length)>0&&e.markets.some((e=>{var t;return(null==(t=null==e?void 0:e.books)?void 0:t.length)>0}))})),a=null!=this.limit&&this.markets&&i.length>0&&i.length>=this._getEffectiveLimit();return r.x`<div class="max-w-screen-lg border-t border-base-200 pt-4">
      <div class="flex gap-2 mb-4 flex-col sm:flex-row sm:items-center">
        ${this.markets?r.x`<div
                class="overflow-hidden w-full sm:max-w-54 justify-between flex items-center px-3 py-2 border border-base-200 rounded-sm focus-within:border-base-300 transition-colors">
                <input
                  type="text"
                  placeholder="Search for player"
                  .value="${this._searchFilter}"
                  @input="${this._handleSearchInput}"
                  class="flex-1 text-sm focus:outline-none" />
                <span class="size-4 ms-2 flex-shrink-0 block">${(0,m.o)('<svg preserveAspectRatio="xMidYMid meet" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">\n    <g clip-path="url(#jqcxzuf71a)">\n        <path d="M10.388 7.687c0-.916-.324-1.698-.973-2.347a3.26 3.26 0 0 0-2.36-.986c-.925-.01-1.711.32-2.36.986-.649.667-.973 1.449-.973 2.347 0 .898.324 1.684.973 2.36.649.675 1.435 1 2.36.973.924-.027 1.711-.35 2.36-.973.649-.622.973-1.41.973-2.36zm3.813 6.2a.89.89 0 0 1-.293.666.955.955 0 0 1-.68.28.867.867 0 0 1-.653-.28l-2.547-2.546c-.889.613-1.88.92-2.973.92a5.166 5.166 0 0 1-2.04-.413 5.094 5.094 0 0 1-1.667-1.12 5.604 5.604 0 0 1-1.12-1.667 4.817 4.817 0 0 1-.413-2.04A5.325 5.325 0 0 1 3.348 3.98a4.92 4.92 0 0 1 1.667-1.12 5.718 5.718 0 0 1 2.04-.413 4.513 4.513 0 0 1 2.04.413 6.231 6.231 0 0 1 1.666 1.12c.48.454.854 1.014 1.12 1.68.267.667.405 1.342.414 2.027a5.117 5.117 0 0 1-.92 2.973l2.546 2.547c.187.186.28.413.28.68z" fill="currentColor"/>\n    </g>\n    <defs>\n        <clipPath id="jqcxzuf71a">\n            <path fill="transparent" transform="matrix(1 0 0 -1 1.334 14.834)" d="M0 0h13.333v13.333H0z"/>\n        </clipPath>\n    </defs>\n</svg>\n')}</span>
              </div>
              <srwc-select-dropdown
                class="sm:max-w-54 flex-1"
                label="Filter by matchup"
                .options="${t}"
                selected="${this._selectedMatchup}"
                .onChange="${this._handleMatchupSelection}">
              </srwc-select-dropdown>`:r.E}
        <srwc-odds-format class="sm:max-w-54 block flex-1"></srwc-odds-format>
      </div>
      ${(null==o?void 0:o.length)>0?o.map(((e,t)=>this._renderPlayerPropsHtml(e,t))):r.E}
      ${a?r.x`<div class="mt-4 flex justify-center">
            <button
              @click="${this._handleLoadMore}"
              class="cursor-pointer self-center font-bold font-body-bold text-center bg-primary rounded-sm px-6 py-3 text-base-100">
              Load More
            </button>
          </div>`:r.E}
      <dialog
        class="p-0 w-[calc(100vw-2.5rem)] max-w-sm m-auto shadow-xl rounded-lg backdrop:bg-base-content/25"
        id="player-props-compare-odds-dialog">
        ${this._renderCompareOddsDialogContent()}
      </dialog>
    </div>`},this._renderOddsCard=(e,t)=>r.x`<div
      class="overflow-hidden p-4 flex max-w-20 sm:max-w-24 w-full items-center justify-center rounded-sm border border-base-200 flex-col">
      <p class="text-xs">${e}</p>
      <p class="text-xl font-bold font-body-bold">${t??r.N}</p>
    </div>`,this._renderError=e=>(console.warn(e),r.x`<slot name="fallback"></slot>`),this._getOddsFormatKeyForMarket=()=>this._oddsFormat===r.O.FRACTIONAL?"fraction":this._oddsFormat.toLowerCase(),this._renderPending=()=>r.x`<div class="max-w-screen-lg">
      ${this.markets?r.x`<div class="flex gap-2 flex-col lg:flex-row border-t border-base-200 pt-4">
            <div class="bg-base-200 rounded-sm animate-pulse h-10 w-full"></div>
            <div class="bg-base-200 rounded-sm animate-pulse h-10 w-full"></div>
            <div class="bg-base-200 rounded-sm animate-pulse h-10 w-full"></div>
          </div>`:r.x`<div class="bg-base-200 rounded-sm animate-pulse h-10 w-full mb-4"></div>`}
      ${Array(this._getEffectiveLimit()||10).fill(null).map((()=>r.x`
            <div class="border-t border-base-200 mt-4 py-2 flex gap-2 flex-col">
              <div class="text-sm pt-2 flex gap-2">
                <div class="bg-base-200 rounded-sm animate-pulse h-4 w-20"></div>
                <div class="bg-base-200 rounded-sm animate-pulse h-4 w-32"></div>
              </div>

              <div class="flex flex-col md:flex-row gap-6 pb-2">
                <div class="flex-1 flex gap-3 flex-col sm:max-w-76">
                  <div class="flex gap-3">
                    <div class="bg-base-200 rounded-full animate-pulse size-16"></div>
                  </div>
                  <div class="bg-base-200 rounded-sm animate-pulse h-8 w-40"></div>
                </div>

                <div class="flex-1 flex flex-col gap-4">
                  ${Array(null!=this&&this.markets?this.markets.length:3).fill(null).map((()=>r.x`
                        <div class="flex flex-col gap-2">
                          <div class="bg-base-200 rounded-sm animate-pulse h-5 w-52"></div>
                          <div class="flex-row flex gap-1">
                            <div class="bg-base-200 rounded-sm animate-pulse h-24 w-full"></div>
                          </div>
                        </div>
                      `))}
                </div>
              </div>

              <div class="bg-base-200 rounded-sm animate-pulse h-4 w-32 self-start"></div>
            </div>
          `))}
    </div>`}connectedCallback(){super.connectedCallback(),document.addEventListener(s.E.ODDS_FORMAT_CHANGE,this._handleOddsFormatChange)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener(s.E.ODDS_FORMAT_CHANGE,this._handleOddsFormatChange)}render(){return r.x`<div global-css>
      ${this.fetchUpcomingGamesTask.render({pending:this._renderPending,initial:this._renderPending,error:this._renderError,complete:this._renderComplete})}
    </div>`}_renderPlayerPropsHtml({player:e,competition:t,markets:o},i){var s,n,l,c,d,u;const{competitors:h}=t||{};let m={name:"",abbreviation:""};if((null==(s=null==h?void 0:h.away)?void 0:s.id)===(null==e?void 0:e.competitor_id)&&(m=null==h?void 0:h.away),(null==(n=null==h?void 0:h.home)?void 0:n.id)===(null==e?void 0:e.competitor_id)&&(m=null==h?void 0:h.home),0===(null==o?void 0:o.length))return r.E;const f=null==(c=null==(l=b.$)?void 0:l["player-props"])?void 0:c.generateLinkToMatchup({competition:t,league:this.league});return r.x`<div class="border-t border-base-200 mt-4 py-2 flex gap-2 flex-col">
      <div class="text-sm pt-4">
        <span class="font-bold font-body-bold">
          ${null==(d=null==h?void 0:h.away)?void 0:d.abbreviation} @ ${null==(u=null==h?void 0:h.home)?void 0:u.abbreviation}
        </span>
        <span class="text-base-300">&mdash; ${(0,a.f)(null==t?void 0:t.scheduled,a.d)}</span>
      </div>
      <div class="flex flex-col md:flex-row gap-6">
        <div class="flex-1 flex gap-3 sm:max-w-76 ${this.markets?"flex-row items-center":"flex-col"}">
          <srwc-player-headshot
            class="flex-shrink-0 ${this.markets?"":"self-start"}"
            .player="${{id:null==e?void 0:e.sr_player_id,name:null==e?void 0:e.name}}"
            .team="${{name:null==m?void 0:m.name,abbreviation:null==m?void 0:m.abbreviation}}"
            league="${this.league}">
          </srwc-player-headshot>
          <p class="font-body-black font-black text-2xl">${null==e?void 0:e.name}</p>
        </div>
        <div class="flex-1 flex flex-col gap-4">
          ${null==o?void 0:o.map(((e,t)=>{var o,s,n,l,c;const d=[];if(null==(o=null==e?void 0:e.books)||o.forEach((e=>{var t;null==(t=null==e?void 0:e.outcomes)||t.forEach(((t,o)=>{t.best&&(d[o]={...t,book:e})}))})),0===(null==(s=null==e?void 0:e.books)?void 0:s.length))return r.E;1===d.length&&("merged"==(null==e?void 0:e.source)||"props"==(null==e?void 0:e.source))&&d.push({type:void 0});const u=(null==(n=null==e?void 0:e.consensus)?void 0:n.outcomes)||[];return r.x`<div class="flex flex-col gap-2">
              ${this.markets?r.E:r.x`<p class="capitalize font-bold font-body-bold">${null==e?void 0:e.name}</p>`}
              <div class="flex-row flex gap-1">
                ${this._renderOddsCard("Open",null==(l=null==u?void 0:u[0])?void 0:l.open_total)}
                ${this._renderOddsCard("Consensus",null==(c=null==u?void 0:u[0])?void 0:c.total)}

                <div class="flex-1 relative z-10 bg-base-100 pe-1 flex gap-1 flex-col">
                  ${d.map((e=>{var t,o,i,s,n;const l=null==(t=null==e?void 0:e.type)?void 0:t.slice(0,1),c=r.x`
                      <div class="flex items-center justify-center">
                        <img
                          onerror="${'this.style="visibility:hidden"'}"
                          src="${a.c.partnerLogo(null==(o=e.book)?void 0:o.name)}"
                          width="24"
                          height="24"
                          class="rounded-full size-6 mr-2" />
                        <div class="flex flex-col items-center">
                          ${null!=e&&e.total?r.x`<span class="whitespace-nowrap"> ${l} ${e.total} </span>`:r.E}
                          <span
                            class="text-xs font-bold font-body-bold text-base-300 transition-colors group-hover:text-base-100 group-focus:text-base-100">
                            ${null==e?void 0:e[`odds_${this._getOddsFormatKeyForMarket()}`]}
                          </span>
                        </div>
                      </div>
                    `,d=null==(s=null==(i=this.books)?void 0:i.find((t=>{var o;return t.id===(null==(o=e.book)?void 0:o.id)})))?void 0:s.clickUrl;return null!=e&&e.type?(0,p.E)(c,d,{brand:null==(n=e.book)?void 0:n.name},"group overflow-hidden text-sm border rounded-sm border-base-200 min-h-[52px] flex-1 items-center flex justify-center hover:bg-success hover:border-success transition-colors hover:text-base-100 focus:bg-success focus:text-base-100"):r.x`<div
                          class="border border-base-200 rounded-sm min-h-[52px] flex-1 items-center flex justify-center">
                          ${r.N}
                        </div>`}))}
                </div>
                <div class="m-auto w-12 relative">
                  <div
                    class="rounded-sm absolute border-2 border-base-200 w-10 h-14 -top-[calc(50%-12px)] -left-[calc(50%-6px)] rounded"></div>
                  <div class="bg-base-100 relative z-10 h-10 items-center justify-center flex">
                    <button
                      aria-label="open compare odds dialog"
                      title="Compare Odds"
                      data-market-index="${i}-${t}"
                      @click="${this._handleCompareOdds}"
                      style="mask: var(--ico-bar-chart-svg);"
                      class="cursor-pointer m-auto block relative size-6 flex-shrink-0 bg-primary"></button>
                  </div>
                </div>
              </div>
            </div>`}))}
        </div>
      </div>
      ${f?r.x`<a
            href="${f||"#"}"
            class="font-bold font-body-bold text-sm flex items-center mt-2 gap-2 self-start">
            <span
              style="mask: var(--ico-bar-chart-svg);"
              class="-rotate-90 -scale-full block size-6 flex-shrink-0 bg-primary"></span>
            Matchup Report
          </a>`:r.E}
    </div>`}_renderCompareOddsDialogContent(){var e,t,o,i,a,s,n;if(!this._compareDialogMarketIndex||!this.fetchUpcomingGamesTask.value)return r.E;const[l,c]=this._compareDialogMarketIndex.split("-").map(Number),d=this.fetchUpcomingGamesTask.value[l],u=null==(e=null==d?void 0:d.markets)?void 0:e[c],{player:h}=d||{};if(!u)return r.E;let b=null==(t=null==u?void 0:u.books)?void 0:t.some((e=>{var t;return 2===(null==(t=null==e?void 0:e.outcomes)?void 0:t.length)}));return("props"==(null==u?void 0:u.source)||"merged"===(null==u?void 0:u.source))&&(b=!0),r.x`<srwc-dialog-content>
      <div slot="body">
        <div class="flex gap-4 flex-col">
          <div class="flex gap-4">
            <srwc-player-headshot
              .player="${{id:null==h?void 0:h.sr_player_id,name:null==h?void 0:h.name}}"
              .team="${{name:(null==h?void 0:h.team_name)??`${null==(o=null==h?void 0:h.team)?void 0:o.market} ${null==(i=null==h?void 0:h.team)?void 0:i.name}`,abbreviation:(null==(a=null==h?void 0:h.team)?void 0:a.abbr)||(null==(s=null==h?void 0:h.team)?void 0:s.alias)||(null==h?void 0:h.team_abbreviation)}}"
              league="${this.league}">
            </srwc-player-headshot>
            <p class="flex flex-col gap-1">
              <span class="font-black text-xl font-body-black">${null==(n=null==d?void 0:d.player)?void 0:n.name}</span>
              <span class="text-sm text-base-300 capitalize">${null==u?void 0:u.name}</span>
            </p>
          </div>
          <p class="gap-2 flex items-center font-bold font-body-bold">
            <span class="size-2 bg-success block rounded-full"></span>
            Best Odds
          </p>
          ${b?this._renderMultipleOutcomesCompare(u):this._renderSingleOutcomeCompare(u)}
        </div>
      </div>
    </srwc-dialog-content>`}_renderMultipleOutcomesCompare(e){var t;return r.x`<div class="flex flex-col gap-2">
      ${null==(t=null==e?void 0:e.books)?void 0:t.map((e=>{var t,o;const i=null==(t=null==e?void 0:e.outcomes)?void 0:t[0],s=null==(o=null==e?void 0:e.outcomes)?void 0:o[1];if(!i&&!s)return r.E;const n=null==i?void 0:i.best,l=null==s?void 0:s.best;return r.x`<div class="flex items-center justify-between gap-4">
          ${this._renderDialogOutcome(i,e,n)}
          <div class="flex items-center justify-center">
            <img
              title="${e.name}"
              loading="lazy"
              onerror="${'this.style="visibility:hidden"'}"
              src="${a.c.partnerLogo(null==e?void 0:e.name)}"
              class="rounded-full flex-shrink-0"
              width="24"
              height="24"
              alt="${e.name}" />
          </div>
          ${this._renderDialogOutcome(s,e,l)}
        </div>`}))}
    </div>`}_renderSingleOutcomeCompare(e){var t;return r.x`<div class="flex flex-col gap-2">
      ${null==(t=null==e?void 0:e.books)?void 0:t.map((e=>{var t,o,i,s;const n=null==(t=null==e?void 0:e.outcomes)?void 0:t[0];if(!n)return r.E;const l=null==n?void 0:n.best,c=null==(o=null==n?void 0:n.type)?void 0:o.slice(0,1),d=r.x`
          <div class="flex items-center justify-center">
            <div class="flex flex-col items-center">
              ${null!=n&&n.total?r.x`<span class="whitespace-nowrap">${c} ${null==n?void 0:n.total}</span>`:r.E}
              <span
                class="text-xs font-bold font-body-bold text-base-300 transition-colors group-hover:text-base-100 group-focus:text-base-100">
                ${null==n?void 0:n[`odds_${this._getOddsFormatKeyForMarket()}`]}
              </span>
            </div>
          </div>
        `,u=null==(s=null==(i=this.books)?void 0:i.find((t=>t.id===(null==e?void 0:e.id))))?void 0:s.clickUrl;return r.x`<div class="flex items-center justify-between gap-4">
          <div class="flex items-center">
            <img
              title="${e.name}"
              loading="lazy"
              onerror="${'this.style="visibility:hidden"'}"
              src="${a.c.partnerLogo(null==e?void 0:e.name)}"
              class="rounded-full group-hover:text-base-100"
              width="24"
              height="24"
              alt="${e.name}" />
          </div>

          <div class="flex-1">
            ${(0,p.E)(d,u,{operator:null==e?void 0:e.name},(l?"border-success":"border-base-200")+" group overflow-hidden text-sm border rounded-sm min-h-[52px] w-full items-center flex justify-center hover:bg-success hover:border-success transition-colors hover:text-base-100")}
          </div>
        </div>`}))}
    </div>`}_renderDialogOutcome(e,t,o){var i,a,s;const n=null==(i=null==e?void 0:e.type)?void 0:i.slice(0,1),l=r.x`
      <div class="flex items-center justify-center">
        <div class="flex flex-col items-center">
          <span class="whitespace-nowrap text-sm">${n} ${null==e?void 0:e.total}</span>
          <span
            class="text-xs font-bold font-body-bold text-base-300 transition-colors group-hover:text-base-100 group-focus:text-base-100">
            ${null==e?void 0:e[`odds_${this._getOddsFormatKeyForMarket()}`]}
          </span>
        </div>
      </div>
    `,c=null==(s=null==(a=this.books)?void 0:a.find((e=>e.id===(null==t?void 0:t.id))))?void 0:s.clickUrl;return e?(0,p.E)(l,c,{operator:null==t?void 0:t.name},"flex-1 group overflow-hidden text-sm border rounded-sm min-h-[52px] w-full items-center flex justify-center transition-colors hover:bg-success hover:border-success transition-colors hover:text-base-100 focus:bg-success focus:text-base-100 "+(o?"border-success":"border-base-200")):r.x`<div class="border border-base-200 rounded-sm min-h-[52px] flex-1 items-center flex justify-center">
          ${r.N}
        </div>`}};z.styles=[r.g,r.i`
      :host {
        ${(0,r.r)(`--ico-bar-chart-svg: url("${h.b}") center/contain no-repeat;`)}
      }
      /* layer: properties */
@supports ((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b)))){*, ::before, ::after, ::backdrop{--un-bg-opacity:100%;--un-border-opacity:100%;--un-border-spacing-x:0;--un-border-spacing-y:0;--un-content:"";--un-text-opacity:100%;--un-outline-opacity:100%;--un-space-x-reverse:0;--un-space-y-reverse:0;--un-translate-x:0;--un-translate-y:0;--un-translate-z:0;--un-scale-x:1;--un-scale-y:1;--un-scale-z:1;}}
@property --un-text-opacity{syntax:"<percentage>";inherits:false;initial-value:100%;}
@property --un-border-opacity{syntax:"<percentage>";inherits:false;initial-value:100%;}
@property --un-bg-opacity{syntax:"<percentage>";inherits:false;initial-value:100%;}
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
@property --un-scale-x{syntax:"*";inherits:false;initial-value:1;}
@property --un-scale-y{syntax:"*";inherits:false;initial-value:1;}
@property --un-scale-z{syntax:"*";inherits:false;initial-value:1;}
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
/* layer: shortcuts */
[global-css=""]{color:color-mix(in srgb, var(--colors-base-content) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-content, oklch(0.28 0.0296 256.85)) */;font-family:var(--font-body);background-color:color-mix(in srgb, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
@supports (color: color-mix(in lab, red, red)){
[global-css=""]{background-color:color-mix(in oklab, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
[global-css=""]{color:color-mix(in oklab, var(--colors-base-content) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-content, oklch(0.28 0.0296 256.85)) */;}
}
/* layer: default */
.text-2xl{font-size:var(--text-2xl-fontSize);line-height:var(--srwc-leading, var(--text-2xl-lineHeight));}
.text-sm{font-size:var(--text-sm-fontSize);line-height:var(--srwc-leading, var(--text-sm-lineHeight));}
.text-xl{font-size:var(--text-xl-fontSize);line-height:var(--srwc-leading, var(--text-xl-lineHeight));}
.text-xs{font-size:var(--text-xs-fontSize);line-height:var(--srwc-leading, var(--text-xs-lineHeight));}
.text-base-100,
.group:hover .group-hover\\:text-base-100,
.group:focus .group-focus\\:text-base-100{color:color-mix(in srgb, var(--colors-base-100) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.text-base-300{color:color-mix(in srgb, var(--colors-base-300) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-300, oklch(0.4 0.0154 237.02)) */;}
.hover\\:text-base-100:hover{color:color-mix(in srgb, var(--colors-base-100) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.focus\\:text-base-100:focus{color:color-mix(in srgb, var(--colors-base-100) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.font-black{--srwc-font-weight:var(--fontWeight-black);font-weight:var(--fontWeight-black);}
.font-body-black{font-family:var(--font-body-black);}
.font-body-bold{font-family:var(--font-body-bold);}
.font-bold{--srwc-font-weight:var(--fontWeight-bold);font-weight:var(--fontWeight-bold);}
.m-auto{margin:auto;}
.mb-4{margin-bottom:calc(var(--spacing) * 4);}
.mr-2{margin-right:calc(var(--spacing) * 2);}
.ms-2{margin-inline-start:calc(var(--spacing) * 2);}
.mt-2{margin-top:calc(var(--spacing) * 2);}
.mt-4{margin-top:calc(var(--spacing) * 4);}
.p-0{padding:calc(var(--spacing) * 0);}
.p-4{padding:calc(var(--spacing) * 4);}
.px-3{padding-inline:calc(var(--spacing) * 3);}
.px-6{padding-inline:calc(var(--spacing) * 6);}
.py-2{padding-block:calc(var(--spacing) * 2);}
.py-3{padding-block:calc(var(--spacing) * 3);}
.pb-2{padding-bottom:calc(var(--spacing) * 2);}
.pe-1{padding-inline-end:calc(var(--spacing) * 1);}
.pt-2{padding-top:calc(var(--spacing) * 2);}
.pt-4{padding-top:calc(var(--spacing) * 4);}
.text-center{text-align:center;}
.focus\\:outline-none:focus{--srwc-outline-style:none;outline-style:none;}
.border{border-width:1px;}
.border-2{border-width:2px;}
.border-t{border-top-width:1px;}
.border-base-200{border-color:color-mix(in srgb, var(--colors-base-200) var(--srwc-border-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
.border-success{border-color:color-mix(in srgb, var(--colors-success) var(--srwc-border-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.focus-within\\:border-base-300:focus-within{border-color:color-mix(in srgb, var(--colors-base-300) var(--srwc-border-opacity), transparent) /* var(--srwc-color-base-300, oklch(0.4 0.0154 237.02)) */;}
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
.focus\\:bg-success:focus{background-color:color-mix(in srgb, var(--colors-success) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.flex{display:flex;}
.flex-1{flex:1 1 0%;}
.flex-shrink-0{flex-shrink:0;}
.flex-row{flex-direction:row;}
.flex-col{flex-direction:column;}
.gap-1{gap:calc(var(--spacing) * 1);}
.gap-2{gap:calc(var(--spacing) * 2);}
.gap-3{gap:calc(var(--spacing) * 3);}
.gap-4{gap:calc(var(--spacing) * 4);}
.gap-6{gap:calc(var(--spacing) * 6);}
.size-16{width:calc(var(--spacing) * 16);height:calc(var(--spacing) * 16);}
.size-2{width:calc(var(--spacing) * 2);height:calc(var(--spacing) * 2);}
.size-4{width:calc(var(--spacing) * 4);height:calc(var(--spacing) * 4);}
.size-6{width:calc(var(--spacing) * 6);height:calc(var(--spacing) * 6);}
.h-10{height:calc(var(--spacing) * 10);}
.h-14{height:calc(var(--spacing) * 14);}
.h-24{height:calc(var(--spacing) * 24);}
.h-4{height:calc(var(--spacing) * 4);}
.h-5{height:calc(var(--spacing) * 5);}
.h-8{height:calc(var(--spacing) * 8);}
.max-w-20{max-width:calc(var(--spacing) * 20);}
.max-w-sm{max-width:var(--container-sm);}
.min-h-\\[52px\\]{min-height:52px;}
.w-\\[calc\\(100vw-2\\.5rem\\)\\]{width:calc(100vw - 2.5rem);}
.w-10{width:calc(var(--spacing) * 10);}
.w-12{width:calc(var(--spacing) * 12);}
.w-20{width:calc(var(--spacing) * 20);}
.w-32{width:calc(var(--spacing) * 32);}
.w-40{width:calc(var(--spacing) * 40);}
.w-52{width:calc(var(--spacing) * 52);}
.w-full{width:100%;}
.max-w-screen-lg{max-width:64rem;}
.block{display:block;}
.cursor-pointer{cursor:pointer;}
.whitespace-nowrap{white-space:nowrap;}
.capitalize{text-transform:capitalize;}
.shadow-xl{--srwc-shadow:0 20px 25px -5px var(--srwc-shadow-color, rgb(0 0 0 / 0.1)),0 8px 10px -6px var(--srwc-shadow-color, rgb(0 0 0 / 0.1));box-shadow:var(--srwc-inset-shadow), var(--srwc-inset-ring-shadow), var(--srwc-ring-offset-shadow), var(--srwc-ring-shadow), var(--srwc-shadow);}
.-rotate-90{rotate:-90deg;}
.-scale-full{--srwc-scale-x:-100%;--srwc-scale-y:-100%;scale:calc(var(--srwc-scale-x) * -1) var(--srwc-scale-y);}
.transition-colors{transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,--un-gradient-from,--un-gradient-via,--un-gradient-to;transition-timing-function:var(--srwc-ease, var(--default-transition-timingFunction));transition-duration:var(--srwc-duration, var(--default-transition-duration));}
.items-center{align-items:center;}
.self-start{align-self:flex-start;}
.self-center{align-self:center;}
.-left-\\[calc\\(50\\%-6px\\)\\]{left:calc(calc(50% - 6px) * -1);}
.-top-\\[calc\\(50\\%-12px\\)\\]{top:calc(calc(50% - 12px) * -1);}
.justify-center{justify-content:center;}
.justify-between{justify-content:space-between;}
.absolute{position:absolute;}
.relative{position:relative;}
.static{position:static;}
.z-10{z-index:10;}
.overflow-hidden{overflow:hidden;}
@keyframes pulse{0%, 100% {opacity:1} 50% {opacity:.5}}
.animate-pulse{animation:pulse 2s cubic-bezier(0.4,0,.6,1) infinite;}
@supports (color: color-mix(in lab, red, red)){
.text-base-100{color:color-mix(in oklab, var(--colors-base-100) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.text-base-300{color:color-mix(in oklab, var(--colors-base-300) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-300, oklch(0.4 0.0154 237.02)) */;}
.group:hover .group-hover\\:text-base-100{color:color-mix(in oklab, var(--colors-base-100) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.hover\\:text-base-100:hover{color:color-mix(in oklab, var(--colors-base-100) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.focus\\:text-base-100:focus{color:color-mix(in oklab, var(--colors-base-100) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.group:focus .group-focus\\:text-base-100{color:color-mix(in oklab, var(--colors-base-100) var(--srwc-text-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.border-base-200{border-color:color-mix(in oklab, var(--colors-base-200) var(--srwc-border-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
.border-success{border-color:color-mix(in oklab, var(--colors-success) var(--srwc-border-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.focus-within\\:border-base-300:focus-within{border-color:color-mix(in oklab, var(--colors-base-300) var(--srwc-border-opacity), transparent) /* var(--srwc-color-base-300, oklch(0.4 0.0154 237.02)) */;}
.hover\\:border-success:hover{border-color:color-mix(in oklab, var(--colors-success) var(--srwc-border-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.backdrop\\:bg-base-content\\/25::backdrop{background-color:color-mix(in oklab, var(--colors-base-content) 25%, transparent) /* var(--srwc-color-base-content, oklch(0.28 0.0296 256.85)) */;}
.bg-base-100{background-color:color-mix(in oklab, var(--colors-base-100) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-100, oklch(1 0 0)) */;}
.bg-base-200{background-color:color-mix(in oklab, var(--colors-base-200) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-base-200, oklch(0.92 0.0155 257.2)) */;}
.bg-primary{background-color:color-mix(in oklab, var(--colors-primary) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-primary, oklch(45% .24 277.023)) */;}
.bg-success{background-color:color-mix(in oklab, var(--colors-success) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.hover\\:bg-success:hover{background-color:color-mix(in oklab, var(--colors-success) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
.focus\\:bg-success:focus{background-color:color-mix(in oklab, var(--colors-success) var(--srwc-bg-opacity), transparent) /* var(--srwc-color-success, oklch(0.66 0.1209 163.1)) */;}
}
@media (min-width: 40rem){
.sm\\:flex-row{flex-direction:row;}
.sm\\:max-w-24{max-width:calc(var(--spacing) * 24);}
.sm\\:max-w-54{max-width:calc(var(--spacing) * 54);}
.sm\\:max-w-76{max-width:calc(var(--spacing) * 76);}
.sm\\:items-center{align-items:center;}
}
@media (min-width: 48rem){
.md\\:flex-row{flex-direction:row;}
}
@media (min-width: 64rem){
.lg\\:flex-row{flex-direction:row;}
};
    `],k([(0,r.n)({type:String,reflect:!0})],z.prototype,"league",2),k([(0,r.n)({type:Array,reflect:!0})],z.prototype,"books",2),k([(0,r.n)({type:Array,reflect:!0})],z.prototype,"markets",2),k([(0,r.n)({type:Number,reflect:!0})],z.prototype,"limit",2),k([(0,i.r)()],z.prototype,"_oddsFormat",2),k([(0,i.r)()],z.prototype,"_compareDialogMarketIndex",2),k([(0,i.r)()],z.prototype,"_searchFilter",2),k([(0,i.r)()],z.prototype,"_selectedMatchup",2),k([(0,i.r)()],z.prototype,"_currentLimit",2),z=k([(0,r.t)(`${r.P}-player-props`)],z)},999:(e,t,o)=>{o.d(t,{r:()=>i});var r=o(948);function i(e){return(0,r.n)({...e,state:!0,attribute:!1})}}}]);