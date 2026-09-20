import { signIn, signUp } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-8 px-6 py-16">
      <h1 className="text-xl font-semibold">Stardust DS</h1>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={signIn} className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-600">Log in</h2>
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
        >
          Log in
        </button>
      </form>

      <form action={signUp} className="flex flex-col gap-3 border-t border-neutral-200 pt-6">
        <h2 className="text-sm font-medium text-neutral-600">Sign up</h2>
        <input
          name="displayName"
          type="text"
          placeholder="Display name"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          minLength={6}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md border border-neutral-900 px-3 py-2 text-sm font-medium text-neutral-900"
        >
          Sign up
        </button>
      </form>
    </main>
  );
}
