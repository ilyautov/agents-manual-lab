# Агент как конечный автомат {data-kicker="ГЛАВА 2 / ДЛЯ ИНЖЕНЕРОВ"}

::: lead
Первая версия агента поддержки была циклом `while (!done)`: спросить модель, выполнить то, что она сказала, повторить. Однажды модель ответила «Возврат оформлен, хорошего дня» и закончила работу. Возврата не было: модель пропустила вызов `create_refund`, а цикл поверил её словам. Такой ошибки не бывает, когда состояние агента знает runtime, а правила смены состояний записаны в коде.
:::

## Почему цикл while ломается

В простом цикле единственное состояние агента живёт в истории сообщений, а решение «закончить» принимает модель. Отсюда три класса поломок.

- **Ложное завершение.** Модель пишет «готово», хотя действие не выполнено. Цикл не может проверить: у него нет понятия «возврат сделан».
- **Невозможные действия.** Модель вызывает `create_refund`, пока заявка ждёт решения человека. В цикле нет состояния «ждём человека», значит нет и запрета.
- **Потерянный контекст после сбоя.** Процесс упал, история в памяти пропала. С какого места продолжать, неизвестно (об этом глава 7).

Решение давно известно из теории автоматов: конечный автомат. У агента есть конечный набор состояний, а переходы между ними разрешены явно, таблицей. Всё, чего нет в таблице, запрещено.

## Состояния и переходы

В лаборатории у агента {{machine.states}} состояний, из них {{machine.terminal}} терминальных, то есть без исходящих переходов.

| Состояние | Что происходит | Кто действует |
|---|---|---|
| idle | заявка принята, работа не начата | runtime |
| planning | модель выбирает следующий шаг | модель |
| acting | runtime проверяет и выполняет вызов инструмента | runtime |
| observing | результат записывается в состояние задачи | runtime |
| waiting_approval | возврат ждёт решения человека | человек |
| done | задача решена, клиент уведомлён | |
| failed | задача не решена, причина записана | |
| handed_off | работа передана человеку с отчётом | |

<figure>
<svg viewBox="0 0 680 250" xmlns="http://www.w3.org/2000/svg" font-family="Book Sans" font-size="12">
<defs><marker id="m2a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#1F2724"/></marker>
<marker id="m2g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#6B706C"/></marker></defs>
<rect x="0" y="0" width="680" height="250" fill="#F6F4EE"/>
<rect x="10" y="98" width="70" height="34" rx="17" fill="#D9DBD3"/><text x="45" y="119" text-anchor="middle" fill="#2B302D">idle</text>
<rect x="120" y="98" width="100" height="34" rx="5" fill="#B5DD4C"/><text x="170" y="119" text-anchor="middle" fill="#1F2724" font-weight="700">planning</text>
<rect x="290" y="20" width="100" height="34" rx="5" fill="#B5DD4C"/><text x="340" y="41" text-anchor="middle" fill="#1F2724" font-weight="700">acting</text>
<rect x="290" y="150" width="100" height="34" rx="5" fill="#B5DD4C"/><text x="340" y="171" text-anchor="middle" fill="#1F2724" font-weight="700">observing</text>
<rect x="100" y="200" width="140" height="34" rx="5" fill="#F4C77D"/><text x="170" y="221" text-anchor="middle" fill="#1F2724" font-weight="700">waiting_approval</text>
<rect x="540" y="20" width="120" height="34" rx="17" fill="#A8DDE1"/><text x="600" y="41" text-anchor="middle" fill="#1F2724">done</text>
<rect x="540" y="98" width="120" height="34" rx="17" fill="#D9DBD3"/><text x="600" y="119" text-anchor="middle" fill="#2B302D">failed</text>
<rect x="540" y="190" width="120" height="34" rx="17" fill="#D9DBD3"/><text x="600" y="211" text-anchor="middle" fill="#2B302D">handed_off</text>
<line x1="80" y1="115" x2="118" y2="115" stroke="#1F2724" stroke-width="1.3" marker-end="url(#m2a)"/>
<path d="M200,98 L288,44" fill="none" stroke="#1F2724" stroke-width="1.3" marker-end="url(#m2a)"/><text x="214" y="64" fill="#2B302D" font-size="11">plan_ready</text>
<line x1="340" y1="54" x2="340" y2="148" stroke="#1F2724" stroke-width="1.3" marker-end="url(#m2a)"/><text x="348" y="104" fill="#2B302D" font-size="11">tool_done</text>
<path d="M290,160 L222,128" fill="none" stroke="#1F2724" stroke-width="1.3" marker-end="url(#m2a)"/><text x="234" y="160" fill="#2B302D" font-size="11">continue</text>
<line x1="170" y1="132" x2="170" y2="198" stroke="#1F2724" stroke-width="1.3" marker-end="url(#m2a)"/><text x="100" y="170" fill="#2B302D" font-size="11">need_approval</text>
<path d="M240,208 C290,200 300,120 318,56" fill="none" stroke="#1F2724" stroke-width="1.3" marker-end="url(#m2a)"/><text x="250" y="104" fill="#2B302D" font-size="11">approved</text>
<path d="M390,158 L538,46" fill="none" stroke="#1F2724" stroke-width="1.3" marker-end="url(#m2a)"/><text x="440" y="86" fill="#2B302D" font-size="11">goal_met (guard)</text>
<line x1="390" y1="167" x2="538" y2="120" stroke="#6B706C" stroke-width="1.2" marker-end="url(#m2g)"/><text x="462" y="152" fill="#6B706C" font-size="11">give_up</text>
<path d="M240,224 L538,210" fill="none" stroke="#6B706C" stroke-width="1.2" stroke-dasharray="4 3" marker-end="url(#m2g)"/><text x="330" y="242" fill="#6B706C" font-size="11">approval_timeout</text>
</svg>
<figcaption>Основные переходы автомата агента. Пунктир: остановка с передачей человеку. Переход в done закрыт охранным условием. Переходы budget_exhausted из planning, acting и observing в handed_off не показаны.</figcaption>
</figure>

Переход задаётся событием. Таблица в коде занимает несколько строк, и в этом её сила: её можно прочитать глазами, проверить тестом и показать юристу.

```ts
export const TRANSITIONS: Record<State, Partial<Record<AgentEvent, State>>> = {
  idle: { start: 'planning' },
  planning: {
    plan_ready: 'acting', need_approval: 'waiting_approval', goal_met: 'done',
    give_up: 'failed', budget_exhausted: 'handed_off',
  },
  acting: { tool_done: 'observing', budget_exhausted: 'handed_off' },
  observing: { continue: 'planning', goal_met: 'done', give_up: 'failed', budget_exhausted: 'handed_off' },
  waiting_approval: { approved: 'acting', rejected: 'planning', approval_timeout: 'handed_off' },
  done: {}, failed: {}, handed_off: {},
};

export function next(state: State, event: AgentEvent): State {
  const to = TRANSITIONS[state][event];
  if (to === undefined) throw new ForbiddenTransition(state, event);
  return to;
}
```

Всего в таблице {{machine.transitions}} переходов. Из {{machine.allPairs}} возможных пар «откуда, куда» разрешены {{machine.allowedPairs}}, остальные {{machine.forbiddenPairs}} запрещены самой структурой. Например, из `waiting_approval` нельзя попасть в `observing`: результата нет, пока человек не ответил. Из `done` нельзя никуда: закрытую заявку нельзя тихо открыть заново, для этого нужна новая заявка.

## Охранные условия

Таблица говорит, какие переходы возможны. Охранное условие (guard) говорит, разрешён ли переход сейчас. В нашем агенте переход по событию `goal_met` проходит, только если runtime видел успешный `send_message` и, когда возврат положен, успешный `create_refund`. Модель может сколько угодно писать «готово»: автомат не перейдёт в `done`, пока факты не подтверждены.

```ts
export function goalVeto(ctx): string | null {
  if (ctx.policy?.eligible && !ctx.refundId && ctx.human !== 'rejected') return 'возврат положен, но не создан';
  if (!ctx.notified) return 'клиент не уведомлён';
  return null;
}
const m = new Machine({ goal_met: () => goalVeto(ctx) });
```

Факты `refundId` и `notified` выставляет runtime по результатам инструментов, а не по тексту модели. Это и есть разделение ролей из введения: модель предлагает, runtime знает. Вето не роняет прогон: автомат остаётся в `planning`, а причина отказа уходит модели как наблюдение. В лаборатории есть и сценарий из лида: планировщик один раз объявляет задачу решённой, не вызвав `create_refund`. Guard отклоняет переход, агент оформляет возврат и заканчивает работу за {{agent.falseFinish.steps}} шагов вместо {{agent.small.steps}}.

## Что даёт автомат

**Проверяемость.** Тест перебирает все {{machine.eventPairs}} пар «состояние, событие»: {{machine.transitions}} разрешённых дают ровно то состояние, что записано в таблице, остальные {{machine.eventForbidden}} бросают ошибку.

**Читаемая история.** Каждый переход пишется в историю: `idle>planning`, `planning>acting`, `acting>observing`. По истории переходов видно, где агент провёл время и где остановился.

**Штатная остановка.** У бюджета, таймаута одобрения и отказа есть свои терминальные состояния. Агент не обрывается посреди работы, а приходит в `handed_off` с причиной.

::: {.warn data-title="Типичная ошибка"}
Состояния заводят, но переходы оставляют на усмотрение модели: в промпте пишут «если нужен человек, перейди в waiting_approval». Модель иногда не переходит, и автомат становится украшением. Переходы выполняет runtime по фактам: сумма выше порога, значит `need_approval`, что бы ни ответила модель.
:::

## Цикл агента в коде

Как автомат управляет циклом, видно по основной функции агента в `src/agent.ts`. Ниже она сокращена: убраны строки трассировки и учёта времени.

```ts
while (!isTerminal(m.state)) {
  if (m.state === 'planning') {
    const u = stepUsage(budget.used.steps);
    if (!budget.check(u).ok) { /* резерв на передачу */ m.send('budget_exhausted'); break; }
    budget.charge(u);
    const action = plan(ctx, gullible, maxReplans);
    if (action.kind === 'finish') { m.send('goal_met'); /* вето guard ловится */ continue; }
    if (action.kind === 'give_up') { m.send('give_up'); continue; }
    pending = action.call;
    const allowed = checkCall(sandboxCtx(ctx, world), pending).allowed;
    const needs = allowed && pending.tool === 'create_refund' && ctx.approvedAmount === null &&
      approvalReasons(requestOf(ctx, world, pending.args.amount as number)).length > 0;
    m.send(needs ? 'need_approval' : 'plan_ready');
  } else if (m.state === 'waiting_approval') { /* ответ человека */ }
  else if (m.state === 'acting') { /* песочница, повторы, вызов */ m.send('tool_done'); }
  else if (m.state === 'observing') { absorb(ctx, pending, observation); m.send('continue'); }
}
```

Посмотрите, где принимаются решения. Модель (здесь функция `plan`) выбирает только действие. Нужен ли человек, решает runtime по сумме и правилам. Хватит ли бюджета, решает трекер до шага. Что изменилось в мире, записывает `absorb` по результату инструмента. Каждое такое решение превращается в событие автомата, и если событие недопустимо в текущем состоянии, цикл остановится с ошибкой, а не сделает что-то неожиданное.

## Автомат, журнал и тесты

Автомат полезен, только если его состояние переживает процесс. Каждый переход записывается в журнал (глава 7) вместе с событием и временем. При перезапуске агент читает последнее состояние и продолжает из него: если заявка была в `waiting_approval`, новый процесс не будет заново читать заказ и проверять политику, он будет ждать ответа человека.

Таблица переходов удобна и для тестов. Кроме полного перебора пар есть тест сильнее: он прогоняет сценарии агента и проверяет историю переходов. В лаборатории заявка Анны начинается с `idle>planning`, `planning>acting`, `acting>observing`, а заявка Бориса обязательно содержит `planning>waiting_approval`. Если после правки кода крупный возврат перестал проходить через ожидание, тест упадёт, даже если итог формально тот же.

## Когда автомат разрастается

{{machine.states}} состояний хватает агенту возврата. Агенту, который ещё ждёт товар на складе, проверяет фото брака и согласует частичную компенсацию, понадобится больше. Два приёма помогают не утонуть.

**Вложенные автоматы.** Внешний автомат описывает бизнес-процесс («ждём товар», «проверяем», «возвращаем деньги»), внутренний описывает цикл агента внутри каждого этапа (`planning`, `acting`, `observing`). Внешний меняется редко и проверяется юристом, внутренний общий для всех этапов.

**Состояния как данные.** Когда состояний десятки, таблицу удобнее хранить в конфигурации и генерировать из неё схему для документации. Тогда схема в описании процесса и поведение кода не расходятся.

Обратный совет тоже важен: не заводите состояние на каждый шаг модели. Состояние отражает ситуацию, в которой допустимы разные действия. Если в двух состояниях разрешено одно и то же, это одно состояние.

## Что сделать на практике

1. Выписать состояния задачи с точки зрения бизнеса, а не модели: «ждём человека», «деньги отправлены», «клиент уведомлён».
2. Описать переходы таблицей, всё остальное запретить.
3. Для каждого перехода в терминальное состояние определить guard, проверяемый по фактам.
4. Хранить текущее состояние вне процесса (база, журнал), чтобы его пережил перезапуск.
5. Отдельно предусмотреть состояние «передано человеку»: агент, который не умеет сдаваться, будет крутиться до лимита.

::: {.lab data-title="Лаборатория"}
`npm run demo:machine` печатает таблицу переходов и пример запрещённого перехода. `test/machine.test.ts` проверяет {{machine.states}} состояний и {{machine.transitions}} переходов, полный перебор пар «состояние, событие» и то, что guard не пускает в `done` без уведомления клиента. `test/agent.test.ts` проверяет, что guard отклоняет завершение, когда письмо отправлено, а положенного возврата нет.
:::

::: {.check data-title="Проверьте себя"}
1. Почему из `waiting_approval` по событию `rejected` агент идёт в `planning`, а не в `done`?
2. Модель вернула «Возврат оформлен», но `create_refund` не вызывался. В каком состоянии окажется агент и почему?
3. Какие состояния вы добавили бы для агента, который ещё и ждёт возврата товара на склад?
:::
