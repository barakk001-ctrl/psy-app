import { LoginForm } from "@/components/auth/login-form";
import { ExplainerVideo } from "@/components/auth/explainer-video";

export default function LoginPage() {
  return (
    <div>
      <LoginForm />
      <div className="mt-6 pt-5 border-t border-cream-200 text-center">
        <ExplainerVideo />
      </div>
    </div>
  );
}
