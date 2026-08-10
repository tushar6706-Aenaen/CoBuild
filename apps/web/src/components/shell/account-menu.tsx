"use client";

import Image from "next/image";
import Link from "next/link";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

/**
 * The avatar in the top bar, as a menu: Profile, Settings, Log out.
 *
 * Built on Radix rather than a hand-rolled popover so focus management,
 * Escape-to-close, click-outside, arrow-key navigation and the `aria-expanded`
 * wiring all come for free — a menu is one of those components that looks
 * trivial and is not.
 *
 * **Log out is a POST, and that is not incidental.** `/auth/signout` refuses
 * GET on purpose: if it accepted one, any third-party page could sign a visitor
 * out with nothing more than `<img src="https://cobuild/auth/signout">`. So the
 * item is a real submit button inside a real form, which also means it still
 * works with JavaScript disabled. It must never become a `<Link>`.
 */
export function AccountMenu({
  username,
  displayName,
  avatarUrl,
}: {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}) {
  const item =
    "flex w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-left text-[13px] font-semibold text-[var(--color-text-secondary)] transition-colors outline-none select-none data-[highlighted]:bg-[var(--color-bg-row-tint)] data-[highlighted]:text-[var(--color-text-primary)]";

  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger
        aria-label="Account menu"
        className="h-10 w-10 flex-none overflow-hidden rounded-full border border-[var(--color-border-default)] bg-[repeating-linear-gradient(135deg,var(--color-bg-raised)_0_4px,var(--color-bg-panel-alt)_4px_8px)] transition-colors outline-none hover:border-[var(--color-border-strong)] focus-visible:border-[var(--color-control-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-border-strong)] data-[state=open]:border-[var(--color-border-strong)]"
      >
        {avatarUrl && (
          <Image
            src={avatarUrl}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="h-full w-full object-cover"
          />
        )}
      </DropdownMenuPrimitive.Trigger>

      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="end"
          sideOffset={8}
          className="z-50 flex w-[212px] flex-col gap-0.5 rounded-[var(--radius-control-lg)] border border-[var(--color-border-strong)] bg-[var(--color-bg-raised)] p-1.5 shadow-[var(--shadow-popover)] duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        >
          {/* Identity, not an action — which is why it is a plain div and not a
              menu item: making it focusable would put a no-op stop in the
              keyboard path between the trigger and the first real option. */}
          <div className="flex flex-col gap-0.5 px-2.5 py-2">
            <span className="truncate text-[13px] font-bold text-[var(--color-text-primary)]">
              {displayName ?? username}
            </span>
            <span className="truncate text-[11.5px] text-[var(--color-text-tertiary)]">
              @{username}
            </span>
          </div>

          <div className="my-1 h-px bg-[var(--color-border-subtle)]" />

          <DropdownMenuPrimitive.Item asChild>
            <Link href={`/u/${username}`} className={item}>
              <UserIcon />
              Profile
            </Link>
          </DropdownMenuPrimitive.Item>

          <DropdownMenuPrimitive.Item asChild>
            <Link href="/settings/profile" className={item}>
              <GearIcon />
              Settings
            </Link>
          </DropdownMenuPrimitive.Item>

          <div className="my-1 h-px bg-[var(--color-border-subtle)]" />

          <form action="/auth/signout" method="post">
            <DropdownMenuPrimitive.Item asChild>
              <button
                type="submit"
                className={`${item} data-[highlighted]:text-[var(--color-status-danger)]`}
              >
                <LogoutIcon />
                Log out
              </button>
            </DropdownMenuPrimitive.Item>
          </form>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

const iconProps = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "flex-none",
};

function UserIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg {...iconProps}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
