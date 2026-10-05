import type { Metadata } from "next";
import { TensorPageShell } from "./TensorPageShell";

export const metadata: Metadata = {
  title: { absolute: "Tensor by Cencori" },
};

export default function TensorPage() {
  return <TensorPageShell />;
}
