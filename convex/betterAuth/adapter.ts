import { createApi } from "@convex-dev/better-auth";
import {
  mutationGeneric, paginationOptsValidator,
  type DataModelFromSchemaDefinition, type DefaultFunctionArgs,
  type GenericMutationCtx, type RegisteredMutation,
} from "convex/server";
import { v } from "convex/values";
import { partial } from "convex-helpers/validators";
import { createAuthOptions } from "../authOptions";
import { memberIntegrity } from "./memberIntegrity";
import schema from "./schema";

type Table = keyof typeof schema.tables;
const api = createApi(schema, () => createAuthOptions(undefined, async () => {
  throw new Error("Component adapter cannot send mail");
}));

const where = v.optional(v.array(v.object({
  field: v.string(),
  operator: v.optional(v.union(
    v.literal("lt"), v.literal("lte"), v.literal("gt"), v.literal("gte"),
    v.literal("eq"), v.literal("in"), v.literal("not_in"), v.literal("ne"),
    v.literal("contains"), v.literal("starts_with"), v.literal("ends_with"),
  )),
  value: v.union(v.string(), v.number(), v.boolean(), v.array(v.string()), v.array(v.number()), v.null()),
  connector: v.optional(v.union(v.literal("AND"), v.literal("OR"))),
  mode: v.optional(v.union(v.literal("sensitive"), v.literal("insensitive"))),
})));
const updateInput = v.union(...Object.entries(schema.tables).map(([model, table]) => v.object({
  model: v.literal(model as Table),
  update: v.object(partial(table.validator.fields)),
  where,
})));
const deleteInput = v.union(...Object.keys(schema.tables).map((model) => v.object({
  model: v.literal(model as Table), where,
})));

export const { findOne, findMany } = api;

type LocalModelArgs<Args extends { input: { model: string } }> = Omit<Args, "input"> & {
  input: Omit<Args["input"], "model"> & { model: Table };
};

function adapterHandler<Args extends DefaultFunctionArgs & { input: { model: string } }, Result>(
  operation: RegisteredMutation<"public", Args, Result>,
) {
  // Convex strips _handler from declarations, and adapter 0.12.5 types write models
  // against its default schema even for local installs. Runtime uses the supplied schema.
  // Guard this version-sensitive boundary; integration tests exercise every write path.
  if (!("_handler" in operation) || typeof operation._handler !== "function") {
    throw new Error("Unsupported Convex adapter handler contract");
  }
  return operation._handler as (
    ctx: GenericMutationCtx<DataModelFromSchemaDefinition<typeof schema>>, args: LocalModelArgs<Args>,
  ) => Result;
}
const handlers = {
  create: adapterHandler(api.create), updateOne: adapterHandler(api.updateOne),
  updateMany: adapterHandler(api.updateMany), deleteOne: adapterHandler(api.deleteOne),
  deleteMany: adapterHandler(api.deleteMany),
};

// Preserve the installed adapter implementation while applying invariant checks inside its transaction.
export const create = mutationGeneric({
  args: {
    input: v.union(...Object.entries(schema.tables).map(([model, table]) => v.object({
      model: v.literal(model as Table), data: v.object(table.validator.fields),
    }))),
    select: v.optional(v.array(v.string())),
    onCreateHandle: v.optional(v.string()),
  },
  handler: (ctx, args) => handlers.create(memberIntegrity.wrapDB(ctx), args),
});
export const updateOne = mutationGeneric({
  args: { input: updateInput, onUpdateHandle: v.optional(v.string()) },
  handler: (ctx, args) => handlers.updateOne(memberIntegrity.wrapDB(ctx), args),
});
export const updateMany = mutationGeneric({
  args: { input: updateInput, paginationOpts: paginationOptsValidator, onUpdateHandle: v.optional(v.string()) },
  handler: (ctx, args) => handlers.updateMany(memberIntegrity.wrapDB(ctx), args),
});
export const deleteOne = mutationGeneric({
  args: { input: deleteInput, onDeleteHandle: v.optional(v.string()) },
  handler: (ctx, args) => handlers.deleteOne(memberIntegrity.wrapDB(ctx), args),
});
export const deleteMany = mutationGeneric({
  args: { input: deleteInput, paginationOpts: paginationOptsValidator, onDeleteHandle: v.optional(v.string()) },
  handler: (ctx, args) => handlers.deleteMany(memberIntegrity.wrapDB(ctx), args),
});
