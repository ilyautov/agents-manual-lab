/** Глава 3: инструменты как контракты. Схема, валидация до вызова, чтение и запись, идемпотентность. */
import { POLICY, ServiceError } from './shop.ts';
import type { World } from './shop.ts';

export interface FieldSpec {
  type: 'string' | 'integer';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
}

export interface ToolSpec {
  name: string;
  kind: 'read' | 'write';
  args: Record<string, FieldSpec>;
}

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: { code: string; message: string; retryable: boolean } };

export const SPECS: ToolSpec[] = [
  { name: 'get_order', kind: 'read', args: { orderId: { type: 'string', required: true, pattern: '^A-\\d{4}$' } } },
  { name: 'check_refund_policy', kind: 'read', args: { orderId: { type: 'string', required: true, pattern: '^A-\\d{4}$' } } },
  {
    name: 'create_refund', kind: 'write', args: {
      orderId: { type: 'string', required: true, pattern: '^A-\\d{4}$' },
      amount: { type: 'integer', required: true, min: 1, max: 1_000_000 },
    },
  },
  {
    name: 'send_message', kind: 'write', args: {
      customerId: { type: 'string', required: true, pattern: '^C-\\d+$' },
      text: { type: 'string', required: true, min: 1, max: 1000 },
    },
  },
];

/** Возвращает список ошибок, понятных модели: поле, ожидание, что пришло. */
export function validateArgs(spec: ToolSpec, args: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(args)) {
    if (!(key in spec.args)) errors.push(`${key}: лишнее поле, допустимы ${Object.keys(spec.args).join(', ')}`);
  }
  for (const [key, f] of Object.entries(spec.args)) {
    const v = args[key];
    if (v === undefined) {
      if (f.required) errors.push(`${key}: обязательное поле`);
      continue;
    }
    if (f.type === 'integer') {
      if (typeof v !== 'number' || !Number.isInteger(v)) errors.push(`${key}: ожидается целое число, получено ${JSON.stringify(v)}`);
      else if ((f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max)) {
        errors.push(`${key}: ожидается от ${f.min} до ${f.max}, получено ${v}`);
      }
    } else {
      if (typeof v !== 'string') errors.push(`${key}: ожидается строка`);
      else if (f.pattern && !new RegExp(f.pattern).test(v)) errors.push(`${key}: не подходит под формат ${f.pattern}, получено "${v}"`);
      else if ((f.min !== undefined && v.length < f.min) || (f.max !== undefined && v.length > f.max)) {
        errors.push(`${key}: длина от ${f.min} до ${f.max} символов`);
      }
    }
  }
  return errors;
}

const RETRYABLE = new Set(['unavailable', 'timeout', 'rate_limited']);

export class ToolRuntime {
  readonly world: World;
  readonly calls: { name: string; ok: boolean }[] = [];

  constructor(world: World) {
    this.world = world;
  }

  spec(name: string): ToolSpec | undefined {
    return SPECS.find((s) => s.name === name);
  }

  call(name: string, args: Record<string, unknown>, idempotencyKey?: string): ToolResult {
    const result = this.dispatch(name, args, idempotencyKey);
    this.calls.push({ name, ok: result.ok });
    return result;
  }

  private dispatch(name: string, args: Record<string, unknown>, key?: string): ToolResult {
    const spec = this.spec(name);
    if (!spec) return fail('unknown_tool', `инструмента ${name} нет`, false);
    const errors = validateArgs(spec, args);
    if (errors.length) return fail('invalid_arguments', errors.join('; '), false);
    if (spec.kind === 'write' && !key) return fail('missing_idempotency_key', 'запись без ключа идемпотентности запрещена', false);
    try {
      return { ok: true, data: this.handle(name, args, key) };
    } catch (e) {
      if (e instanceof ServiceError) return fail(e.code, e.message, RETRYABLE.has(e.code));
      throw e;
    }
  }

  private handle(name: string, args: Record<string, unknown>, key?: string): unknown {
    const w = this.world;
    const order = typeof args.orderId === 'string' ? w.orders.get(args.orderId) : undefined;
    switch (name) {
      case 'get_order':
        if (!order) throw new ServiceError('not_found', `заказ ${args.orderId} не найден`);
        return { ...order };
      case 'check_refund_policy': {
        if (!order) throw new ServiceError('not_found', `заказ ${args.orderId} не найден`);
        const eligible = order.deliveredDaysAgo <= POLICY.returnDays;
        const amount = order.total - order.refunded;
        return {
          eligible,
          reason: eligible ? 'в пределах срока возврата' : `прошло ${order.deliveredDaysAgo} дн., срок ${POLICY.returnDays}`,
          amount,
          needsApproval: amount > POLICY.approvalThreshold,
        };
      }
      case 'create_refund':
        return w.payments.refund(args.orderId as string, args.amount as number, key);
      case 'send_message': {
        const c = w.customers.get(args.customerId as string);
        if (!c) throw new ServiceError('not_found', `клиент ${args.customerId} не найден`);
        return w.notifier.send(c.email, args.text as string, key);
      }
    }
    throw new ServiceError('unknown_tool', name);
  }
}

function fail(code: string, message: string, retryable: boolean): ToolResult {
  return { ok: false, error: { code, message, retryable } };
}
