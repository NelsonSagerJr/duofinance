<script setup>
import { ref, computed } from 'vue'
import { state, saveCategory, moveCategory } from '../../lib/store.js'
import { COLORS, ICONS, chipClass } from '../../lib/categories.js'
import Modal from '../FixedBills/Modal.vue'

const KINDS = [
  { id: 'expense', label: 'Gastos', icon: 'shopping_bag' },
  { id: 'income', label: 'Entradas', icon: 'payments' },
]
const kind = ref('expense')
const list = computed(() => state.categories.filter((c) => c.kind === kind.value))
const active = computed(() => list.value.filter((c) => !c.archived))
const archived = computed(() => list.value.filter((c) => c.archived))

const error = ref('')
const notice = ref('')
const busyId = ref(null)
const friendly = (e) => (e.code === '23505' ? 'Já existe uma categoria com esse nome.' : e.message)
async function run(id, fn) {
  error.value = ''
  notice.value = ''
  busyId.value = id
  try {
    await fn()
  } catch (e) {
    error.value = friendly(e)
  } finally {
    busyId.value = null
  }
}

// ---- create / edit
const editing = ref(null) // { id?, kind, name, icon, color }
const formError = ref('')
const saving = ref(false)
const openNew = () => {
  formError.value = ''
  editing.value = { kind: kind.value, name: '', icon: kind.value === 'income' ? 'payments' : 'shopping_cart', color: 'primary' }
}
const openEdit = (c) => {
  formError.value = ''
  editing.value = { ...c }
}
async function save() {
  const c = editing.value
  const name = c.name.trim()
  formError.value = ''
  if (!name) return (formError.value = 'Dê um nome à categoria.')
  if (/[<>]/.test(name)) return (formError.value = 'O nome não pode ter < ou >.')
  saving.value = true
  try {
    await saveCategory({ ...c, name })
    editing.value = null
  } catch (e) {
    formError.value = friendly(e)
  } finally {
    saving.value = false
  }
}

const toggleArchive = (c) => run(c.id, () => saveCategory({ ...c, archived: !c.archived }))

// ---- "Excluir" = archive (optionally moving the entries first). Never a real delete: that would only fail when
// the partner's private entries use it, revealing that they do.
const inUse = ref(null) // category being removed
const target = ref('')
const targets = computed(() => (inUse.value ? active.value.filter((c) => c.id !== inUse.value.id) : []))
function remove(c) {
  inUse.value = c
  target.value = targets.value[0]?.id || ''
}
function archiveInUse() {
  const c = inUse.value
  inUse.value = null
  run(c.id, async () => {
    await saveCategory({ ...c, archived: true })
    notice.value = `"${c.name}" foi arquivada: some das opções novas e o histórico continua igual.`
  })
}
function moveAndDelete() {
  const c = inUse.value
  const to = state.categories.find((o) => o.id === target.value)
  if (!to) return
  inUse.value = null
  run(c.id, async () => {
    await moveCategory(c.id, to.id)
    notice.value = `Lançamentos da casa e os seus foram para "${to.name}", e "${c.name}" foi arquivada.`
  })
}

const iconBtn = 'w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface disabled:opacity-50'
const input = 'w-full rounded-lg border-0 bg-surface-container-low px-3 py-2.5 text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none'
const label = 'font-label-md text-label-md text-on-surface-variant'
const primaryBtn = 'inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg transition-all active:scale-95 disabled:opacity-60'
</script>

<template>
  <section id="categorias" data-tour="categories" class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0 flex-1 basis-60">
        <h2 class="font-headline-md text-headline-md text-on-surface">Categorias</h2>
        <p class="text-body-sm text-on-surface-variant">A lista é da casa: os dois veem e editam. Quais gastos pessoais usam cada uma continua privado.</p>
      </div>
      <button type="button" data-tour="category-new" :class="primaryBtn" @click="openNew">
        <span class="material-symbols-outlined text-[18px]">add_circle</span>Nova categoria
      </button>
    </div>

    <div role="tablist" aria-label="Tipo de categoria" class="self-start flex bg-surface-container rounded-lg p-1 gap-1">
      <button v-for="k in KINDS" :key="k.id" type="button" role="tab" :aria-selected="kind === k.id"
        class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md font-label-lg text-label-lg transition-colors"
        :class="kind === k.id ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'"
        @click="kind = k.id">
        <span class="material-symbols-outlined text-[18px]">{{ k.icon }}</span>{{ k.label }}
      </button>
    </div>

    <p v-if="error" role="alert" class="rounded-lg bg-error-container text-on-error-container px-3 py-2 text-body-sm">{{ error }}</p>
    <p v-if="notice" role="status" class="rounded-lg bg-surface-container-low px-3 py-2 text-body-sm text-on-surface">{{ notice }}</p>

    <p v-if="!active.length" class="text-body-md text-on-surface-variant">Nenhuma categoria ativa. Crie uma em <b class="text-on-surface">Nova categoria</b>.</p>
    <ul v-else data-tour="category-list" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-space-md">
      <li v-for="c in active" :key="c.id" class="flex items-center gap-3 py-2 border-b border-surface-container min-w-0">
        <span class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" :class="chipClass(c)"><span class="material-symbols-outlined text-[20px]">{{ c.icon }}</span></span>
        <span class="flex-1 min-w-0 truncate text-body-md text-on-surface">{{ c.name }}</span>
        <span data-tour="category-actions" class="flex items-center shrink-0">
          <button type="button" :disabled="busyId === c.id" :class="iconBtn" title="Editar" :aria-label="`Editar ${c.name}`" @click="openEdit(c)"><span class="material-symbols-outlined text-[20px]">edit</span></button>
          <button type="button" :disabled="busyId === c.id" :class="iconBtn" title="Arquivar" :aria-label="`Arquivar ${c.name}`" @click="toggleArchive(c)"><span class="material-symbols-outlined text-[20px]">archive</span></button>
          <button type="button" :disabled="busyId === c.id" :class="iconBtn" class="hover:!bg-error-container hover:!text-on-error-container" title="Excluir" :aria-label="`Excluir ${c.name}`" @click="remove(c)"><span class="material-symbols-outlined text-[20px]">delete</span></button>
        </span>
      </li>
    </ul>

    <details v-if="archived.length" class="rounded-lg bg-surface-container-low">
      <summary class="cursor-pointer px-3 py-2.5 font-label-lg text-label-lg text-on-surface-variant">Arquivadas ({{ archived.length }}) · fora das opções novas, o histórico continua</summary>
      <ul class="px-3 pb-2">
        <li v-for="c in archived" :key="c.id" class="flex items-center gap-3 py-2 min-w-0">
          <span class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 opacity-70" :class="chipClass(c)"><span class="material-symbols-outlined text-[18px]">{{ c.icon }}</span></span>
          <span class="flex-1 min-w-0 truncate text-body-md text-on-surface-variant">{{ c.name }}</span>
          <button type="button" :disabled="busyId === c.id" class="shrink-0 inline-flex items-center gap-1 px-3 h-9 rounded-lg text-primary hover:bg-surface-container-high font-label-md text-label-md" :aria-label="`Reativar ${c.name}`" @click="toggleArchive(c)">
            <span class="material-symbols-outlined text-[18px]">unarchive</span>Reativar
          </button>
          <button type="button" :disabled="busyId === c.id" :class="iconBtn" title="Excluir" :aria-label="`Excluir ${c.name}`" @click="remove(c)"><span class="material-symbols-outlined text-[20px]">delete</span></button>
        </li>
      </ul>
    </details>

    <Modal v-if="editing" :title="editing.id ? 'Editar categoria' : `Nova categoria de ${editing.kind === 'income' ? 'entrada' : 'gasto'}`" @close="editing = null">
      <form class="flex flex-col gap-space-md" @submit.prevent="save">
        <div class="flex items-center gap-3">
          <span class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" :class="chipClass(editing)"><span class="material-symbols-outlined text-[24px]">{{ editing.icon }}</span></span>
          <label class="flex flex-col gap-1 flex-1 min-w-0">
            <span :class="label">Nome</span>
            <input v-model="editing.name" required maxlength="40" placeholder="Ex: Mercado, Farmácia" :class="input" />
          </label>
        </div>
        <p v-if="editing.id" class="text-body-sm text-on-surface-variant">Renomear muda o nome em todo o histórico.</p>

        <fieldset class="flex flex-col gap-1.5">
          <legend :class="label" class="mb-1.5">Ícone</legend>
          <div role="radiogroup" aria-label="Ícone" class="grid grid-cols-7 sm:grid-cols-9 gap-1 p-0.5">
            <button v-for="i in ICONS" :key="i" type="button" role="radio" :aria-checked="editing.icon === i" :aria-label="i" :title="i"
              class="aspect-square flex items-center justify-center rounded-lg transition-colors"
              :class="editing.icon === i ? 'bg-primary-container text-on-primary-container ring-2 ring-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'"
              @click="editing.icon = i">
              <span class="material-symbols-outlined text-[20px]">{{ i }}</span>
            </button>
          </div>
        </fieldset>

        <fieldset class="flex flex-col gap-1.5">
          <legend :class="label" class="mb-1.5">Cor</legend>
          <div role="radiogroup" aria-label="Cor" class="flex flex-wrap gap-2">
            <button v-for="(c, key) in COLORS" :key="key" type="button" role="radio" :aria-checked="editing.color === key" :aria-label="c.label" :title="c.label"
              class="w-8 h-8 rounded-full flex items-center justify-center ring-offset-2 ring-offset-surface-container-lowest transition-shadow"
              :class="[c.dot, editing.color === key ? 'ring-2 ring-on-surface' : '']"
              @click="editing.color = key">
              <span v-if="editing.color === key" class="material-symbols-outlined text-[18px] text-surface-container-lowest">check</span>
            </button>
          </div>
        </fieldset>

        <p v-if="formError" role="alert" class="rounded-lg bg-error-container text-on-error-container px-3 py-2 text-body-sm">{{ formError }}</p>
        <div class="flex gap-space-sm justify-end">
          <button type="button" class="px-4 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-lg text-label-lg" @click="editing = null">Cancelar</button>
          <button type="submit" :disabled="saving" :class="primaryBtn">
            <span class="material-symbols-outlined text-[18px]">{{ editing.id ? 'save' : 'add' }}</span>{{ saving ? 'Salvando…' : editing.id ? 'Salvar' : 'Criar' }}
          </button>
        </div>
      </form>
    </Modal>

    <Modal v-if="inUse" title="Excluir categoria" @close="inUse = null">
      <p class="text-body-md text-on-surface-variant">
        Excluir <b class="text-on-surface">{{ inUse.name }}</b> arquiva a categoria: ela some das opções e o histórico continua igual. Dá para desarquivar depois.
      </p>
      <div class="rounded-lg bg-surface-container-low p-3 flex flex-col gap-2">
        <p class="text-body-sm text-on-surface"><b>Arquivar</b>: some das opções novas e o histórico fica como está.</p>
        <button type="button" class="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-lg text-label-lg" @click="archiveInUse">
          <span class="material-symbols-outlined text-[18px]">archive</span>Arquivar
        </button>
      </div>
      <form v-if="targets.length" class="rounded-lg bg-surface-container-low p-3 flex flex-col gap-2" @submit.prevent="moveAndDelete">
        <label class="flex flex-col gap-1">
          <span class="text-body-sm text-on-surface"><b>Mover lançamentos para…</b> e arquivar</span>
          <select v-model="target" required :class="input" class="!bg-surface-container-lowest">
            <option v-for="c in targets" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <p class="text-body-sm text-on-surface-variant">Move os lançamentos da casa, as contas fixas e os seus lançamentos e limites. Lançamentos privados da outra pessoa não mudam.</p>
        <button type="submit" class="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-error text-on-error hover:bg-error/90 font-label-lg text-label-lg">
          <span class="material-symbols-outlined text-[18px]">drive_file_move</span>Mover e arquivar
        </button>
      </form>
    </Modal>
  </section>
</template>
