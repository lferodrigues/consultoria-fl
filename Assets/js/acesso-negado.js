// Tela de "Acesso negado" — personal dando bronca no aluno na academia.
// Uso: import { mostrarAcessoNegado } from "./acesso-negado.js";
//      mostrarAcessoNegado({ texto: "Faça o seu login para entrar." });

const CSS = `
.an-tela {
    position: fixed; inset: 0; z-index: 200; overflow-y: auto;
    display: flex; align-items: center; justify-content: center; padding: 24px;
    font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #f3f4f6;
    background:
        radial-gradient(700px 420px at 50% 30%, rgba(227, 32, 43, .25), transparent 65%),
        #07080b;
}
.an-caixa { width: 100%; max-width: 640px; text-align: center; }
.an-cena { width: 100%; max-width: 600px; height: auto; display: block; margin: 0 auto; }
.an-titulo {
    font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 900; text-transform: uppercase;
    font-size: clamp(2.2rem, 7vw, 3.6rem); line-height: 1; color: #ff3b45; margin-top: 8px;
    letter-spacing: -.01em; text-shadow: 0 8px 40px rgba(227, 32, 43, .45);
    animation: an-tremor .5s ease-in-out 1.1s 2;
}
.an-texto { color: #c4c8cf; font-size: 1.1rem; margin-top: 12px; }
.an-acoes { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 26px; }
.an-btn {
    display: inline-flex; align-items: center; gap: 8px; padding: 14px 26px; border-radius: 10px;
    font-weight: 800; font-size: .85rem; letter-spacing: .06em; text-transform: uppercase; text-decoration: none;
    transition: transform .2s, filter .2s, border-color .2s;
}
.an-btn-primario {
    color: #fff; background: linear-gradient(180deg, #ff3b45, #e3202b);
    box-shadow: 0 10px 30px -8px rgba(227, 32, 43, .65);
}
.an-btn-primario:hover { transform: translateY(-2px); filter: brightness(1.08); }
.an-btn-fantasma { color: #f3f4f6; border: 1px solid rgba(255, 255, 255, .12); background: rgba(255, 255, 255, .03); }
.an-btn-fantasma:hover { border-color: rgba(255, 255, 255, .3); }

/* Animações da cena */
.an-cena * { transform-box: fill-box; }
.an-braco { transform-origin: 8% 92%; animation: an-dedo .45s ease-in-out infinite alternate; }
.an-cabeca { transform-origin: 50% 100%; animation: an-cabeca .9s ease-in-out infinite alternate; }
.an-boca { transform-origin: 50% 0%; animation: an-boca .3s ease-in-out infinite alternate; }
.an-apito { transform-origin: 50% 0%; animation: an-apito 1s ease-in-out infinite alternate; }
.an-veia { transform-origin: center; animation: an-pulso .6s ease-in-out infinite alternate; }
.an-balao { transform-origin: 85% 100%; animation: an-pop .5s cubic-bezier(.2, 1.6, .4, 1) .3s both; }
.an-aluno { animation: an-treme .12s linear infinite alternate; }
.an-suor { animation: an-gota 1.2s ease-in infinite; }
.an-suor.s2 { animation-delay: .6s; }
.an-grito { transform-origin: center; animation: an-pulso .4s ease-in-out infinite alternate; }

@keyframes an-dedo { from { transform: rotate(-14deg); } to { transform: rotate(10deg); } }
@keyframes an-cabeca { from { transform: rotate(-3deg); } to { transform: rotate(3deg); } }
@keyframes an-boca { from { transform: scaleY(.55); } to { transform: scaleY(1.05); } }
@keyframes an-apito { from { transform: rotate(-12deg); } to { transform: rotate(12deg); } }
@keyframes an-pulso { from { transform: scale(.85); opacity: .7; } to { transform: scale(1.12); opacity: 1; } }
@keyframes an-pop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes an-treme { from { transform: translateX(-1.5px); } to { transform: translateX(1.5px); } }
@keyframes an-gota { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(26px); opacity: 0; } }
@keyframes an-tremor { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }

@media (prefers-reduced-motion: reduce) {
    .an-cena *, .an-titulo { animation: none !important; }
}
`;

// Cena original em SVG: academia ao fundo, personal à esquerda, aluno à direita
const CENA = `
<svg class="an-cena" viewBox="0 0 600 380" role="img" aria-label="Personal trainer dando bronca em um aluno na academia">
  <defs>
    <linearGradient id="an-chao" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1a1d24"/><stop offset="1" stop-color="#0b0c10"/>
    </linearGradient>
    <radialGradient id="an-luz" cx=".5" cy="0" r=".8">
      <stop offset="0" stop-color="#ff3b45" stop-opacity=".35"/><stop offset="1" stop-color="#ff3b45" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Fundo da academia -->
  <rect x="0" y="0" width="600" height="330" fill="#101218"/>
  <rect x="0" y="0" width="600" height="330" fill="url(#an-luz)"/>
  <g stroke="#1d2129" stroke-width="2">
    <line x1="0" y1="90" x2="600" y2="90"/><line x1="0" y1="200" x2="600" y2="200"/>
  </g>
  <!-- Espelho -->
  <rect x="380" y="30" width="200" height="150" rx="6" fill="#151922" stroke="#262b35" stroke-width="3"/>
  <line x1="410" y1="45" x2="470" y2="165" stroke="#1f242e" stroke-width="10"/>
  <!-- Rack com barra e anilhas -->
  <g fill="#2a2e37">
    <rect x="40" y="70" width="10" height="260"/><rect x="140" y="70" width="10" height="260"/>
    <rect x="30" y="70" width="130" height="8"/>
  </g>
  <rect x="20" y="150" width="150" height="6" rx="3" fill="#9aa0ab"/>
  <rect x="12" y="128" width="12" height="50" rx="3" fill="#e3202b"/>
  <rect x="166" y="128" width="12" height="50" rx="3" fill="#e3202b"/>
  <!-- Halteres no chão -->
  <g>
    <rect x="200" y="318" width="44" height="6" rx="3" fill="#9aa0ab"/>
    <rect x="194" y="310" width="12" height="22" rx="3" fill="#2a2e37"/><rect x="238" y="310" width="12" height="22" rx="3" fill="#2a2e37"/>
  </g>
  <!-- Chão -->
  <rect x="0" y="330" width="600" height="50" fill="url(#an-chao)"/>
  <line x1="0" y1="330" x2="600" y2="330" stroke="#e3202b" stroke-opacity=".35" stroke-width="2"/>
  <ellipse cx="300" cy="338" rx="70" ry="7" fill="#000" opacity=".45"/>
  <ellipse cx="480" cy="338" rx="45" ry="5" fill="#000" opacity=".45"/>

  <!-- ===== Personal (dando bronca) ===== -->
  <g>
    <!-- Pernas -->
    <rect x="268" y="250" width="26" height="82" rx="8" fill="#22252d"/>
    <rect x="306" y="250" width="26" height="82" rx="8" fill="#22252d"/>
    <rect x="260" y="324" width="40" height="12" rx="6" fill="#f3f4f6"/>
    <rect x="300" y="324" width="40" height="12" rx="6" fill="#f3f4f6"/>
    <!-- Braço esquerdo na cintura -->
    <path d="M252 178 C 228 200, 226 228, 258 246" fill="none" stroke="#c98d60" stroke-width="18" stroke-linecap="round"/>
    <!-- Tronco (camiseta) -->
    <path d="M250 172 Q300 152 350 172 L344 262 Q300 272 256 262 Z" fill="#e3202b"/>
    <path d="M282 162 Q300 182 318 162" fill="none" stroke="#a3121a" stroke-width="4"/>
    <!-- Cordão do apito -->
    <path d="M284 160 Q300 205 316 160" fill="none" stroke="#f3f4f6" stroke-width="2"/>
    <g class="an-apito">
      <path d="M300 196 L300 204" stroke="#f3f4f6" stroke-width="2"/>
      <rect x="292" y="203" width="18" height="10" rx="5" fill="#cbd5e1"/>
    </g>
    <!-- Braço direito levantado com a mão aberta, sinal de "pare" (balança) -->
    <g class="an-braco">
      <path d="M346 178 C 372 160, 382 130, 378 98" fill="none" stroke="#c98d60" stroke-width="18" stroke-linecap="round"/>
      <!-- Mão aberta, palma para a frente: sinal de "pare" (todos os dedos levantados) -->
      <g fill="#c98d60">
        <rect x="363" y="78" width="30" height="26" rx="9"/>
        <rect x="363" y="58" width="6.5" height="28" rx="3.25"/>
        <rect x="370.5" y="52" width="6.5" height="32" rx="3.25"/>
        <rect x="378" y="53" width="6.5" height="31" rx="3.25"/>
        <rect x="385.5" y="59" width="6.5" height="26" rx="3.25"/>
      </g>
      <line x1="362" y1="97" x2="352" y2="83" stroke="#c98d60" stroke-width="7" stroke-linecap="round"/>
      <g stroke="#a8724c" stroke-width="1.2" stroke-linecap="round">
        <line x1="369.8" y1="80" x2="369.8" y2="86"/><line x1="377.3" y1="80" x2="377.3" y2="86"/><line x1="384.8" y1="80" x2="384.8" y2="86"/>
      </g>
    </g>
    <!-- Cabeça -->
    <g class="an-cabeca">
      <rect x="290" y="140" width="20" height="18" fill="#b97f55"/>
      <circle cx="300" cy="112" r="36" fill="#c98d60"/>
      <!-- Boné -->
      <path d="M264 104 Q266 70 300 70 Q334 70 336 104 Z" fill="#14161c"/>
      <rect x="296" y="98" width="62" height="9" rx="4" fill="#14161c"/>
      <!-- Sobrancelhas bravas -->
      <path d="M278 108 L296 116" stroke="#14161c" stroke-width="5" stroke-linecap="round"/>
      <path d="M322 108 L304 116" stroke="#14161c" stroke-width="5" stroke-linecap="round"/>
      <!-- Olhos -->
      <circle cx="288" cy="122" r="4" fill="#14161c"/><circle cx="312" cy="122" r="4" fill="#14161c"/>
      <!-- Boca gritando -->
      <g class="an-boca">
        <ellipse cx="300" cy="137" rx="11" ry="9" fill="#5b1015"/>
        <ellipse cx="300" cy="141" rx="6" ry="3.5" fill="#ff6b73"/>
      </g>
      <!-- Veia de raiva -->
      <g class="an-veia" stroke="#ff3b45" stroke-width="3.5" stroke-linecap="round">
        <path d="M326 84 l6 6 M338 84 l-6 6 M326 96 l6 -6 M338 96 l-6 -6"/>
      </g>
    </g>
  </g>

  <!-- Balão de fala -->
  <g class="an-balao">
    <rect x="40" y="18" width="210" height="64" rx="14" fill="#f3f4f6"/>
    <path d="M220 80 L248 104 L196 80 Z" fill="#f3f4f6"/>
    <text x="145" y="45" text-anchor="middle" font-family="Montserrat, Inter, sans-serif" font-weight="900" font-size="19" fill="#0b0c10">EI! SEM LOGIN</text>
    <text x="145" y="68" text-anchor="middle" font-family="Montserrat, Inter, sans-serif" font-weight="900" font-size="19" fill="#e3202b">NÃO TREINA!</text>
  </g>

  <!-- Linhas de grito -->
  <g class="an-grito" stroke="#ff3b45" stroke-width="4" stroke-linecap="round">
    <line x1="410" y1="112" x2="430" y2="104"/><line x1="412" y1="128" x2="434" y2="128"/><line x1="410" y1="144" x2="430" y2="152"/>
  </g>

  <!-- ===== Aluno (assustado) ===== -->
  <g class="an-aluno">
    <!-- Pernas -->
    <rect x="460" y="270" width="18" height="62" rx="6" fill="#3b82f6"/>
    <rect x="484" y="270" width="18" height="62" rx="6" fill="#3b82f6"/>
    <rect x="454" y="326" width="28" height="10" rx="5" fill="#f3f4f6"/><rect x="482" y="326" width="28" height="10" rx="5" fill="#f3f4f6"/>
    <!-- Tronco (regata) -->
    <path d="M452 210 Q481 198 510 210 L506 276 Q481 282 456 276 Z" fill="#6b7280"/>
    <!-- Braço segurando halter -->
    <path d="M456 216 C 440 236, 440 256, 452 266" fill="none" stroke="#e0b088" stroke-width="12" stroke-linecap="round"/>
    <rect x="436" y="262" width="30" height="5" rx="2.5" fill="#9aa0ab"/>
    <rect x="432" y="255" width="9" height="19" rx="3" fill="#2a2e37"/><rect x="461" y="255" width="9" height="19" rx="3" fill="#2a2e37"/>
    <!-- Outro braço encolhido -->
    <path d="M506 216 C 520 232, 516 250, 504 254" fill="none" stroke="#e0b088" stroke-width="12" stroke-linecap="round"/>
    <!-- Cabeça -->
    <rect x="474" y="186" width="14" height="14" fill="#cf9e78"/>
    <circle cx="481" cy="168" r="26" fill="#e0b088"/>
    <path d="M456 160 Q458 138 481 138 Q505 138 506 160 Q494 150 481 152 Q468 150 456 160 Z" fill="#3a2a20"/>
    <!-- Faixa na testa -->
    <rect x="456" y="154" width="50" height="7" rx="3" fill="#e3202b"/>
    <!-- Sobrancelhas preocupadas -->
    <path d="M466 166 L474 162" stroke="#3a2a20" stroke-width="3" stroke-linecap="round"/>
    <path d="M496 166 L488 162" stroke="#3a2a20" stroke-width="3" stroke-linecap="round"/>
    <!-- Olhos arregalados -->
    <circle cx="472" cy="172" r="5" fill="#fff"/><circle cx="472" cy="172" r="2.5" fill="#14161c"/>
    <circle cx="490" cy="172" r="5" fill="#fff"/><circle cx="490" cy="172" r="2.5" fill="#14161c"/>
    <!-- Boca "o" -->
    <ellipse cx="481" cy="185" rx="4" ry="5" fill="#5b1015"/>
  </g>
  <!-- Gotas de suor -->
  <path class="an-suor" d="M512 150 q5 8 0 11 q-5 -3 0 -11 Z" fill="#7dd3fc"/>
  <path class="an-suor s2" d="M452 158 q5 8 0 11 q-5 -3 0 -11 Z" fill="#7dd3fc"/>
</svg>`;

export function mostrarAcessoNegado({
    texto = "Faça o seu login para entrar.",
    botao = "Fazer login",
    link = "./login.html"
} = {}) {
    document.title = "Acesso negado | Fagner Lage";

    if (!document.getElementById("an-estilo")) {
        const estilo = document.createElement("style");
        estilo.id = "an-estilo";
        estilo.textContent = CSS;
        document.head.appendChild(estilo);
    }

    // Esconde todo o conteúdo protegido da página
    Array.from(document.body.children).forEach((el) => {
        if (el.tagName !== "SCRIPT") el.hidden = true;
    });

    const tela = document.createElement("main");
    tela.className = "an-tela";
    tela.innerHTML = `
        <div class="an-caixa">
            ${CENA}
            <h1 class="an-titulo">Acesso negado</h1>
            <p class="an-texto"></p>
            <div class="an-acoes">
                <a class="an-btn an-btn-primario"></a>
                <a class="an-btn an-btn-fantasma" href="./index.html">Voltar ao site</a>
            </div>
        </div>`;
    tela.querySelector(".an-texto").textContent = texto;
    const btn = tela.querySelector(".an-btn-primario");
    btn.textContent = botao;
    btn.href = link;
    document.body.appendChild(tela);
}
