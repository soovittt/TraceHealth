import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";

// Email + password, plus an Anonymous "guest" provider so anyone (e.g. a judge)
// can try the app with zero typing — one click creates a throwaway account.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        return {
          email: params.email as string,
          name: (params.name as string) || (params.email as string),
        };
      },
    }),
    Anonymous(),
  ],
});
