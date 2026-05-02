import React from "react";

export type IconProps = {
  filled?: boolean;
} & React.ComponentProps<any>;

export type IconComponent = React.ComponentType<IconProps>;