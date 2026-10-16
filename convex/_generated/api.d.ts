/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents from "../agents.js";
import type * as assistant from "../assistant.js";
import type * as assistantOperations from "../assistantOperations.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as authEnvironment from "../authEnvironment.js";
import type * as authImport from "../authImport.js";
import type * as authMail from "../authMail.js";
import type * as authMigration from "../authMigration.js";
import type * as authOptions from "../authOptions.js";
import type * as authRollback from "../authRollback.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as documentModel from "../documentModel.js";
import type * as documents from "../documents.js";
import type * as graphSnapshot from "../graphSnapshot.js";
import type * as http from "../http.js";
import type * as knowledge from "../knowledge.js";
import type * as migrations from "../migrations.js";
import type * as organizations from "../organizations.js";
import type * as permissions from "../permissions.js";
import type * as retrieval from "../retrieval.js";
import type * as search from "../search.js";
import type * as security from "../security.js";
import type * as tenancy from "../tenancy.js";
import type * as users from "../users.js";
import type * as validation from "../validation.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  assistant: typeof assistant;
  assistantOperations: typeof assistantOperations;
  audit: typeof audit;
  auth: typeof auth;
  authEnvironment: typeof authEnvironment;
  authImport: typeof authImport;
  authMail: typeof authMail;
  authMigration: typeof authMigration;
  authOptions: typeof authOptions;
  authRollback: typeof authRollback;
  crons: typeof crons;
  dashboard: typeof dashboard;
  documentModel: typeof documentModel;
  documents: typeof documents;
  graphSnapshot: typeof graphSnapshot;
  http: typeof http;
  knowledge: typeof knowledge;
  migrations: typeof migrations;
  organizations: typeof organizations;
  permissions: typeof permissions;
  retrieval: typeof retrieval;
  search: typeof search;
  security: typeof security;
  tenancy: typeof tenancy;
  users: typeof users;
  validation: typeof validation;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
};
