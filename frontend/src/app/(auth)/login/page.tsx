"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import { AuthResponse } from "@/types/api";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  InputGroupButton,
} from "@/components/ui/input-group";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Shield,
  Briefcase,
  Package,
  Calculator,
  Command,
} from "lucide-react";
import Image from "next/image";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const router = useRouter();

  // Already signed in? Don't sit on the login form. Waits for hydration for the
  // same reason ProtectedRoute does — before it, everyone looks signed out.
  useEffect(() => {
    if (hasHydrated && isAuthenticated) {
      router.replace("/inventory");
    }
  }, [hasHydrated, isAuthenticated, router]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setLoading(true);
      setError("");

      const response = await apiClient.post<AuthResponse>("/auth/login", data);
      login(response.data.user, response.data.accessToken);

      // Straight to the destination — going via "/" added a redirect hop.
      // replace, so Back doesn't land on the login form again.
      router.replace("/inventory");
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      setError(
        error.response?.data?.error?.message ||
          "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fillDummy = (email: string, pass: string) => {
    setValue("email", email, { shouldValidate: true });
    setValue("password", pass, { shouldValidate: true });
  };

  return (
    <div className="flex w-full min-h-screen">
      {/* Left Panel */}
      <div className="relative w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 xl:p-16 bg-white">
        {/* Header Logo */}
        <div className="absolute top-8 left-8 sm:top-8 sm:left-8">
          <div className="flex items-center gap-2 font-bold text-xl text-ink">
            <Command className="w-6 h-6" />
            Godown
          </div>
        </div>

        {/* Form Container */}
        <div className="w-full max-w-sm mx-auto">
          <div className="text-center mb-8 mt-16 sm:mt-0">
            <div className="relative w-[120px] h-[120px] mx-auto mb-6 flex items-center justify-center">
              {/* Outer faint circle */}
              <div className="absolute inset-0 bg-neutral-50/80 rounded-full"></div>
              {/* Inner circle */}
              <div className="relative w-[72px] h-[72px] bg-white rounded-full flex items-center justify-center shadow-sm border border-neutral-100/80">
                <User className="w-8 h-8 text-ink" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-ink mb-2">
              Login to your account
            </h1>
            <p className="text-muted-foreground text-sm">
              Enter your details to login.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Dummy Login Quick Buttons */}
            <div className="grid grid-cols-2 gap-3 mb-2">
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  fillDummy("aarti.admin@godown.test", "Password@123")
                }
                className="h-11 border-neutral-200 hover:bg-neutral-50 text-muted-foreground hover:text-ink transition-colors flex items-center justify-center gap-2"
                title="Admin Account"
              >
                <Shield className="w-4 h-4" />
                <span className="text-sm font-medium">Admin</span>
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  fillDummy("nikhil.sales@godown.test", "Password@123")
                }
                className="h-11 border-neutral-200 hover:bg-neutral-50 text-muted-foreground hover:text-ink transition-colors flex items-center justify-center gap-2"
                title="Sales Account"
              >
                <Briefcase className="w-4 h-4" />
                <span className="text-sm font-medium">Sales</span>
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  fillDummy("suresh.warehouse@godown.test", "Password@123")
                }
                className="h-11 border-neutral-200 hover:bg-neutral-50 text-muted-foreground hover:text-ink transition-colors flex items-center justify-center gap-2"
                title="Warehouse Account"
              >
                <Package className="w-4 h-4" />
                <span className="text-sm font-medium">Warehouse</span>
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  fillDummy("meera.accounts@godown.test", "Password@123")
                }
                className="h-11 border-neutral-200 hover:bg-neutral-50 text-muted-foreground hover:text-ink transition-colors flex items-center justify-center gap-2"
                title="Accounts Account"
              >
                <Calculator className="w-4 h-4" />
                <span className="text-sm font-medium">Accounts</span>
              </Button>
            </div>

            <div className="flex items-center gap-4 py-3">
              <div className="flex-1 h-px bg-neutral-100"></div>
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                OR
              </span>
              <div className="flex-1 h-px bg-neutral-100"></div>
            </div>

            {error && (
              <div className="p-3 text-sm font-medium text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email Address<span className="text-blue-500">*</span>
              </Label>
              <InputGroup className="h-11 rounded-lg border-neutral-200">
                <InputGroupAddon>
                  <InputGroupText>
                    <Mail />
                  </InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="email"
                  type="email"
                  placeholder="hello@godown.app"
                  {...register("email")}
                />
              </InputGroup>
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password<span className="text-blue-500">*</span>
              </Label>
              <InputGroup className="h-11 rounded-lg border-neutral-200">
                <InputGroupAddon>
                  <InputGroupText>
                    <Lock />
                  </InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  {...register("password")}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-ink hover:bg-transparent h-8 w-8"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-1 pb-4">
              <div className="flex items-center gap-2">
                <Checkbox id="keepLogged" />
                <Label
                  htmlFor="keepLogged"
                  className="text-sm font-normal cursor-pointer"
                >
                  Keep me logged in
                </Label>
              </div>
              <a
                href="#"
                className="text-sm font-medium text-ink hover:underline decoration-neutral-400 underline-offset-4"
              >
                Forgot password?
              </a>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-ink text-white hover:bg-ink/90 rounded-lg text-sm font-medium shadow-sm transition-all"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Login"}
            </Button>
          </form>
        </div>
      </div>

      {/* Right Panel (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 bg-[#f9fafb] relative items-center justify-center p-16 overflow-hidden border-l border-neutral-100">
        {/* Subtle grid background around main content */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_20%,transparent_100%)]"></div>

        {/* Glowing orb effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white rounded-full blur-[100px] opacity-60"></div>

        <div className="relative z-10 max-w-lg w-full">
          <div className="mb-8">
            <Image
              src="https://i.pravatar.cc/150?img=52"
              alt="Wei Chen"
              width={48}
              height={48}
              className="w-12 h-12 rounded-full ring-4 ring-white shadow-sm object-cover"
            />
          </div>

          <h2 className="text-[32px] lg:text-[40px] font-medium text-ink leading-[1.15] tracking-tight mb-8">
            Godown has transformed our daily operations.{" "}
            <span className="text-muted-foreground">
              Its seamless integration of CRM, inventory, and sales orders
              ensures our stock is always perfectly synced.
            </span>
          </h2>

          <div>
            <p className="font-semibold text-ink text-[15px]">Smith Jenkins</p>
            <p className="text-muted-foreground text-sm">Operations Director</p>
          </div>

          {/* Dots indicator */}
          <div className="flex gap-2 mt-12">
            <div className="w-5 h-1.5 bg-ink rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-neutral-300 rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-neutral-300 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
