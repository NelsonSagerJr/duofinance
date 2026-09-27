<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { state, partner } from '../lib/store.js'
import { startTour } from '../lib/tour.js'

const router = useRouter()
// Worked examples use the household's real member names (never hardcoded).
const a = computed(() => state.members[0]?.name || 'Pessoa 1')
const b = computed(() => state.members[1]?.name || 'Pessoa 2')
const other = computed(() => partner.value?.name || 'a outra pessoa')

const box = 'group bg-surface-container-lowest rounded-xl shadow-sm'
const summary = 'flex items-center gap-3 cursor-pointer select-none list-none px-space-md md:px-space-lg py-4 font-headline-sm text-headline-sm text-on-surface rounded-xl hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden'
const body = 'px-space-md md:px-space-lg pb-space-lg flex flex-col gap-3 text-body-md text-on-surface-variant [&_b]:text-on-surface [&_b]:font-semibold'
const ol = 'list-decimal pl-5 flex flex-col gap-1.5 marker:text-primary marker:font-semibold'
const ex = 'rounded-lg bg-surface-container-low p-3 flex flex-col gap-1 text-body-sm'
</script>

<template>
  <div class="flex flex-col gap-space-lg max-w-3xl">
    <header class="flex flex-col gap-space-md">
      <div>
        <h1 class="font-headline-lg text-headline-lg md:font-headline-xl md:text-headline-xl text-on-surface">Como usar</h1>
        <p class="text-body-md text-on-surface-variant mt-1">O DuoFinance passo a passo, com exemplos em reais. Toque num tópico para abrir.</p>
      </div>
      <button type="button" data-tour="help-restart"
        class="self-start inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg transition-all active:scale-95"
        @click="startTour(router)">
        <span class="material-symbols-outlined text-[18px]">tour</span>Refazer o tour guiado
      </button>
    </header>

    <div class="flex flex-col gap-space-sm">
      <details :class="box" open>
        <summary :class="summary"><span class="material-symbols-outlined text-primary">rocket_launch</span><span class="flex-1">Primeiros passos</span><span class="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span></summary>
        <div :class="body">
          <ol :class="ol">
            <li><b>Entre</b> com seu e-mail e senha. Cada um de vocês tem o próprio login. Os dois veem os mesmos <b>gastos da casa</b>, contas fixas, acerto e metas; os <b>gastos pessoais</b> de cada um são privados.</li>
            <li>Vá em <b>Acerto &amp; Metas → Configurações</b> (no fim da página).</li>
            <li>Confira <b>seu nome</b>. É ele que aparece em "quem pagou" e nos resumos.</li>
            <li>Defina <b>sua parte nas despesas da casa (%)</b>. A outra pessoa fica automaticamente com o resto. O padrão é 50/50. Mudar depois só vale para os <b>próximos</b> lançamentos: cada gasto guarda a divisão com que foi salvo, então meses já fechados não mudam.</li>
            <li>Clique em <b>Salvar</b>. Pronto: comece a lançar os gastos do mês.</li>
          </ol>
          <p>Dica: cadastre logo as contas que se repetem todo mês em <b>Custos Fixos</b> (veja abaixo).</p>
        </div>
      </details>

      <details :class="box">
        <summary :class="summary"><span class="material-symbols-outlined text-primary">home</span><span class="flex-1">Lançar um gasto da casa</span><span class="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span></summary>
        <div :class="body">
          <p>Gasto da casa é tudo que é dos dois: mercado, luz, aluguel, faxina… Ele <b>entra no acerto</b>.</p>
          <ol :class="ol">
            <li>Clique em <b>Novo Lançamento</b> (no topo) ou use o <b>Lançamento Rápido</b> da Visão Geral.</li>
            <li>Deixe marcado <b>Casa</b>.</li>
            <li>Preencha descrição, valor (ex.: <b>150,90</b>), data e categoria.</li>
            <li>Em <b>Quem pagou?</b>, escolha quem tirou o dinheiro do bolso.</li>
            <li>Clique em <b>Adicionar</b>.</li>
          </ol>
          <div :class="ex"><span><b>Exemplo:</b> {{ a }} pagou R$ 300,00 de mercado → lance "Mercado", R$ 300,00, Casa, pago por {{ a }}. Em 50/50, {{ b }} passa a dever R$ 150,00 desse gasto.</span></div>
          <p>Para corrigir ou apagar, use o lápis ou a lixeira em Atividades Recentes ou na tabela de Despesas da casa.</p>
        </div>
      </details>

      <details :class="box">
        <summary :class="summary"><span class="material-symbols-outlined text-primary">lock</span><span class="flex-1">Lançar um gasto pessoal (privado)</span><span class="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span></summary>
        <div :class="body">
          <p>Gasto pessoal é só seu: roupa, academia, presente. Ele é <b>privado</b>: só você vê. A outra pessoa não vê o lançamento, nem o total, nem a categoria. E ele <b>não entra no acerto</b>.</p>
          <ol :class="ol">
            <li>Abra <b>Novo Lançamento</b> e toque em <b>Pessoal</b>, ou vá em <b>Meu Espaço → Adicionar gasto pessoal</b>.</li>
            <li>Preencha descrição, valor, data e categoria. Não precisa dizer quem pagou: gasto pessoal é sempre seu.</li>
            <li>Clique em <b>Adicionar</b>.</li>
          </ol>
          <p>Em <b>Meu Espaço</b> você vê o total do mês por categoria e seu extrato. Quando {{ other }} entra com o próprio login, vê só os gastos pessoais dele(a).</p>
          <div :class="ex"><span><b>Cuidado:</b> se você lançar um gasto da casa como Pessoal por engano, {{ other }} não vai vê-lo e ele fica fora do acerto. Para corrigir, abra o gasto em Meu Espaço, toque no lápis, troque para <b>Casa</b>, escolha quem pagou e salve.</span></div>
        </div>
      </details>

      <details :class="box">
        <summary :class="summary"><span class="material-symbols-outlined text-primary">percent</span><span class="flex-1">Dividir um gasto diferente do padrão</span><span class="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span></summary>
        <div :class="body">
          <p>Às vezes um gasto específico não deve seguir a divisão padrão. Dá para mudar só nele:</p>
          <ol :class="ol">
            <li>Num lançamento <b>Casa</b>, marque <b>Dividir diferente do padrão</b>.</li>
            <li>Digite a porcentagem de {{ a }}. A de {{ b }} é calculada sozinha (100 − o que você digitou).</li>
            <li>Salve. Os outros gastos continuam na divisão padrão.</li>
          </ol>
          <div :class="ex"><span><b>Exemplo:</b> aluguel de R$ 2.000,00 em 70/30 → {{ a }} deve R$ 1.400,00 e {{ b }} deve R$ 600,00, só nesse lançamento.</span></div>
          <p>Na tabela de Despesas da casa (Acerto &amp; Metas), a coluna <b>Divisão</b> mostra o % usado em cada gasto.</p>
        </div>
      </details>

      <details :class="box">
        <summary :class="summary"><span class="material-symbols-outlined text-primary">home_work</span><span class="flex-1">Contas fixas mês a mês</span><span class="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span></summary>
        <div :class="body">
          <p>Contas fixas são as que se repetem todo mês: aluguel, internet, condomínio, streaming.</p>
          <ol :class="ol">
            <li>Em <b>Custos Fixos</b>, clique em <b>Adicionar Custo Fixo</b>: nome, valor, dia de vencimento e categoria. Você faz isso <b>uma vez só</b>.</li>
            <li>Todo mês a conta aparece como <b>Pendente</b> (ainda não venceu) ou <b>Vencida</b> (passou do dia sem pagamento). Ela também aparece em Próximos Vencimentos na Visão Geral.</li>
            <li>Quando pagar, clique em <b>Marcar como paga</b> e escolha quem pagou. O app cria um <b>gasto da casa</b> naquele mês com o valor da conta, e ele entra no acerto.</li>
            <li>Errou? A seta <b>Desfazer</b> apaga o pagamento do mês. O lápis edita a conta; a lixeira exclui (pagamentos antigos ficam no histórico).</li>
          </ol>
          <div :class="ex"><span><b>Exemplo:</b> Internet R$ 120,00, vence dia 10. Em setembro, {{ b }} paga e marca como paga → vira um gasto da casa de R$ 120,00 pago por {{ b }}; em 50/50, {{ a }} deve R$ 60,00 dele.</span></div>
          <p>Se o valor mudou, edite a conta antes de marcar como paga. Uma conta inativa fica guardada mas não aparece como pendente.</p>
        </div>
      </details>

      <details :class="box">
        <summary :class="summary"><span class="material-symbols-outlined text-primary">balance</span><span class="flex-1">Como o acerto é calculado</span><span class="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span></summary>
        <div :class="body">
          <p>Só os gastos da <b>casa</b> do mês entram (gastos pessoais nunca). Para cada pessoa:</p>
          <ul class="list-disc pl-5 flex flex-col gap-1">
            <li><b>Devido</b>: a parte dela em cada gasto (pela divisão salva naquele gasto: a padrão do dia em que foi lançado, ou a personalizada).</li>
            <li><b>Pago</b>: quanto ela realmente pagou.</li>
            <li><b>Saldo</b> = Pago − Devido. Quem fica com saldo negativo transfere esse valor para o outro.</li>
          </ul>
          <div :class="ex">
            <span><b>Exemplo 50/50:</b> {{ a }} pagou R$ 300,00 de mercado e {{ b }} pagou R$ 100,00 de luz. Total da casa: R$ 400,00.</span>
            <span>Devido: R$ 200,00 cada. Saldo de {{ a }}: 300 − 200 = <b>+R$ 100,00</b>. Saldo de {{ b }}: 100 − 200 = <b>−R$ 100,00</b>.</span>
            <span>→ <b>{{ b }} transfere R$ 100,00 para {{ a }}</b>.</span>
          </div>
          <div :class="ex">
            <span><b>Exemplo 60/40</b> ({{ a }} 60%, {{ b }} 40%), mesmos gastos:</span>
            <span>Devido: {{ a }} R$ 240,00, {{ b }} R$ 160,00. Saldo de {{ a }}: 300 − 240 = <b>+R$ 60,00</b>. Saldo de {{ b }}: 100 − 160 = <b>−R$ 60,00</b>.</span>
            <span>→ <b>{{ b }} transfere R$ 60,00 para {{ a }}</b>.</span>
          </div>
          <p>Os valores são calculados em centavos; se sobrar 1 centavo de arredondamento, ele fica com quem pagou.</p>
        </div>
      </details>

      <details :class="box">
        <summary :class="summary"><span class="material-symbols-outlined text-primary">check_circle</span><span class="flex-1">Marcar o acerto como quitado</span><span class="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span></summary>
        <div :class="body">
          <ol :class="ol">
            <li>Em <b>Acerto &amp; Metas</b>, veja quem transfere quanto para quem.</li>
            <li>Faça a transferência fora do app (Pix, dinheiro…).</li>
            <li>Clique em <b>Marcar como quitado</b> e confirme. O valor pendente do mês zera e aparece "Já quitado neste mês".</li>
          </ol>
          <p>Se depois alguém lançar mais um gasto da casa naquele mês, o app mostra só a <b>diferença nova</b> a transferir.</p>
        </div>
      </details>

      <details :class="box">
        <summary :class="summary"><span class="material-symbols-outlined text-primary">savings</span><span class="flex-1">Metas e aportes</span><span class="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span></summary>
        <div :class="body">
          <ol :class="ol">
            <li>Em <b>Acerto &amp; Metas</b>, clique em <b>Criar nova meta</b>: nome (ex.: "Viagem de férias"), valor alvo e prazo opcional.</li>
            <li>Sempre que alguém guardar dinheiro, clique em <b>Aportar</b> na meta, informe o valor, a data e quem aportou.</li>
            <li>A barra mostra o progresso, e o card mostra quanto cada um já guardou.</li>
          </ol>
          <div :class="ex"><span><b>Exemplo:</b> meta de R$ 6.000,00. {{ a }} aporta R$ 1.000,00 e {{ b }} R$ 500,00 → 25% concluído.</span></div>
          <p>Metas não entram no acerto da casa.</p>
        </div>
      </details>

      <details :class="box">
        <summary :class="summary"><span class="material-symbols-outlined text-primary">calendar_month</span><span class="flex-1">Trocar de mês</span><span class="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span></summary>
        <div :class="body">
          <p>Use as setas ‹ › ao lado do mês, no topo da tela. Tudo muda junto: totais, contas fixas do mês, gastos pessoais e acerto. Um gasto entra no mês da <b>data</b> dele.</p>
        </div>
      </details>

      <details :class="box">
        <summary :class="summary"><span class="material-symbols-outlined text-primary">dark_mode</span><span class="flex-1">Tema claro ou escuro</span><span class="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span></summary>
        <div :class="body">
          <p><b>No computador:</b> no fim do menu lateral, escolha sistema, claro ou escuro.</p>
          <p><b>No celular:</b> toque no ícone de tema no topo; cada toque alterna entre sistema, claro e escuro. A escolha fica salva neste aparelho.</p>
        </div>
      </details>

      <details :class="box">
        <summary :class="summary"><span class="material-symbols-outlined text-primary">install_mobile</span><span class="flex-1">Instalar no celular</span><span class="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span></summary>
        <div :class="body">
          <p><b>Android (Chrome)</b></p>
          <ol :class="ol">
            <li>Abra o DuoFinance no Chrome e faça login.</li>
            <li>Toque no menu <b>⋮</b> (canto superior direito).</li>
            <li>Toque em <b>Adicionar à tela inicial</b> (ou <b>Instalar app</b>) e confirme.</li>
          </ol>
          <p><b>iPhone (Safari)</b></p>
          <ol :class="ol">
            <li>Abra o DuoFinance no Safari e faça login.</li>
            <li>Toque no botão <b>Compartilhar</b> (quadrado com seta para cima).</li>
            <li>Role e toque em <b>Adicionar à Tela de Início</b>, depois em <b>Adicionar</b>.</li>
          </ol>
          <p>O ícone do DuoFinance aparece junto com os outros apps e abre em tela cheia. É preciso internet para usar.</p>
        </div>
      </details>

      <details :class="box">
        <summary :class="summary"><span class="material-symbols-outlined text-primary">logout</span><span class="flex-1">Sair</span><span class="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span></summary>
        <div :class="body">
          <p>No computador, clique em <b>Sair</b> no fim do menu lateral. No celular, toque no ícone de sair no topo, ou use o botão <b>Sair</b> em Acerto &amp; Metas → Configurações. Seus dados continuam salvos.</p>
        </div>
      </details>
    </div>
  </div>
</template>
