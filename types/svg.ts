import { SVGProps as ReactOfficialSVGProps } from "react";

export type IconProps = ReactOfficialSVGProps<SVGSVGElement> & {
  secondaryfill?: string;
  strokewidth?: number;
  title?: string;
};
