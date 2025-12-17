"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/app/lib/auth";

export default function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        setUser(data.user);
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchUser();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  if (isLoading) {
    return null;
  }

  if (!user) {
    return (
      <a
        href="/login"
        className="px-4 py-2 text-blue-600 dark:text-blue-400 hover:underline"
      >
        Войти
      </a>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-gray-700 dark:text-gray-300 text-sm">
        {user.name}
      </span>
      <button
        onClick={handleLogout}
        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
      >
        Выйти
      </button>
    </div>
  );
}

