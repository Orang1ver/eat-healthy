"use client";

import { useEffect } from "react";
import { seedDefaultIngredientsIfEmpty, seedTakeoutMockIfEmpty } from "../lib/storage";

/** 首次启动时预置默认数据，渲染空内容 */
export function AppInit() {
  useEffect(() => {
    seedDefaultIngredientsIfEmpty();
    seedTakeoutMockIfEmpty();
  }, []);
  return null;
}
