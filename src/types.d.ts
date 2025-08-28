// Declaraciones de tipos para React
import * as React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

declare module 'react' {
  export = React;
  export interface FC<P = {}> {
    (props: P): React.ReactElement | null;
    displayName?: string;
  }
  export type ReactNode = React.ReactNode;
  export type FormEvent<T = Element> = React.FormEvent<T>;
  export type ChangeEvent<T = Element> = React.ChangeEvent<T>;
  export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
  export function createContext<T>(defaultValue: T): React.Context<T>;
  export function useContext<T>(context: React.Context<T>): T;
}

declare module 'lucide-react' {
  import { FC, SVGProps } from 'react';
  
  export interface IconProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
  }
  
  export const Eye: FC<IconProps>;
  export const EyeOff: FC<IconProps>;
  export const Mail: FC<IconProps>;
  export const Lock: FC<IconProps>;
}

// Minimal typings for xlsx and file-saver when @types packages are not present
declare module 'xlsx' {
  export type WorkBook = any;
  export type WorkSheet = any;
  export const utils: {
    aoa_to_sheet(data: any[][]): WorkSheet;
    book_new(): WorkBook;
    book_append_sheet(wb: WorkBook, ws: WorkSheet, name: string): void;
    sheet_to_json(sheet: WorkSheet, opts?: any): any[];
  };
  export function read(data: any, opts?: any): WorkBook;
  export function write(wb: WorkBook, opts?: any): any;
}

declare module 'file-saver' {
  export function saveAs(data: Blob | File | string, filename?: string, options?: any): void;
  const _default: any;
  export default _default;
}
