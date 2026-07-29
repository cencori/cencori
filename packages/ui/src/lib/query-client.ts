import {
  QueryClient,
  environmentManager,
  defaultShouldDehydrateQuery,
} from "@tanstack/react-query"
import { cache } from "react"
import superjson from "superjson"

export const TOKEN_MINUTE = 1000 * 60

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 5 * TOKEN_MINUTE,
        staleTime: 30 * TOKEN_MINUTE,
        retry: 1,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      },
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

const getRequestQueryClient = cache(() => makeQueryClient())

export function getQueryClient() {
  if (environmentManager.isServer()) {
    return getRequestQueryClient()
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}
