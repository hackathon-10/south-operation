import { Body, Query } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { ZodSchema } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ZodValidationPipe } from './zod.pipe';

/**
 * גשר בין סכמות Zod לבין Swagger.
 * הסכמה משמשת גם לאימות בפועל וגם לתיעוד ה-API, כך שאין סיכון לפער ביניהם.
 */
function toJsonSchema(schema: ZodSchema, name: string): Record<string, any> {
  return zodToJsonSchema(schema, {
    name,
    target: 'openApi3',
    $refStrategy: 'none',
  }) as Record<string, any>;
}

/** גוף בקשה מאומת + מתועד ב-Swagger. */
export function ZodBody(schema: ZodSchema, name: string, examples?: Record<string, unknown>) {
  const jsonSchema = toJsonSchema(schema, name);
  const definition = jsonSchema.definitions?.[name] ?? jsonSchema;

  return (target: object, propertyKey: string | symbol, parameterIndex: number) => {
    // תיעוד Swagger ברמת ה-handler.
    ApiBody({
      schema: definition,
      examples: examples
        ? { דוגמה: { value: examples } }
        : undefined,
    })(target, propertyKey as string, Object.getOwnPropertyDescriptor(target, propertyKey)!);

    Body(new ZodValidationPipe(schema))(target, propertyKey, parameterIndex);
  };
}

/** Query מאומת + מתועד ב-Swagger. */
export function ZodQuery(schema: ZodSchema, name: string) {
  const jsonSchema = toJsonSchema(schema, name);
  const definition = (jsonSchema.definitions?.[name] ?? jsonSchema) as {
    properties?: Record<string, any>;
    required?: string[];
  };

  return (target: object, propertyKey: string | symbol, parameterIndex: number) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, propertyKey)!;
    for (const [property, propertySchema] of Object.entries(definition.properties ?? {})) {
      ApiQuery({
        name: property,
        required: definition.required?.includes(property) ?? false,
        schema: propertySchema,
      })(target, propertyKey as string, descriptor);
    }

    Query(new ZodValidationPipe(schema))(target, propertyKey, parameterIndex);
  };
}
