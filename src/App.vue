<script setup></script>

<template>
  <div
    class="flex min-h-screen flex-col items-center bg-black pt-16 text-white sm:justify-center sm:pt-0"
  >
    <div class="relative mt-12 w-full max-w-lg sm:mt-10">
      <div
        class="relative -mb-px h-px w-full bg-gradient-to-r from-transparent via-sky-300 to-transparent"
      ></div>
      <div
        class="mx-5 rounded-lg border border-white/20 border-b-white/20 border-l-white/20 border-r-white/20 shadow-[20px_0_20px_20px] shadow-slate-500/10 sm:border-t-white/20 sm:shadow-sm lg:rounded-xl lg:shadow-none dark:border-b-white/50 dark:border-t-white/50 dark:shadow-white/20"
      >
        <div class="flex flex-col p-6">
          <h3 class="text-xl font-semibold leading-6 tracking-tighter">
            Connect to ChromaDB
          </h3>
        </div>
        <div class="p-6 pt-0">
          <form @submit.prevent>
            <div>
              <div>
                <div
                  class="group relative rounded-lg border px-3 pb-1.5 pt-2.5 duration-200 focus-within:border-sky-200 focus-within:ring focus-within:ring-sky-300/30"
                >
                  <div class="flex justify-between">
                    <label
                      class="text-muted-foreground text-xs font-medium text-gray-400 group-focus-within:text-white"
                      >URL <span class="text-red-500">*</span></label
                    >
                  </div>
                  <input
                    type="text"
                    name="url"
                    autocomplete="off"
                    class="file:bg-accent placeholder:text-muted-foreground/90 text-foreground block w-full border-0 bg-transparent p-0 text-sm file:my-1 file:rounded-full file:border-0 file:px-4 file:py-2 file:font-medium focus:outline-none focus:ring-0 sm:leading-7"
                  />
                </div>
              </div>
            </div>
            <div class="mt-4">
              <div>
                <div
                  class="group relative rounded-lg border px-3 pb-1.5 pt-2.5 duration-200 focus-within:border-sky-200 focus-within:ring focus-within:ring-sky-300/30"
                >
                  <div class="flex justify-between">
                    <label
                      class="text-muted-foreground text-xs font-medium text-gray-400 group-focus-within:text-white"
                      >Tenant <span class="text-red-500">*</span></label
                    >
                  </div>
                  <div class="flex items-center">
                    <input
                      type="text"
                      name="tenant"
                      class="placeholder:text-muted-foreground/90 text-foreground block w-full border-0 bg-transparent p-0 text-sm file:my-1 focus:outline-none focus:ring-0 focus:ring-teal-500 sm:leading-7"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-4">
              <div>
                <div
                  class="group relative rounded-lg border px-3 pb-1.5 pt-2.5 duration-200 focus-within:border-sky-200 focus-within:ring focus-within:ring-sky-300/30"
                >
                  <div class="flex justify-between">
                    <label
                      class="text-muted-foreground text-xs font-medium text-gray-400 group-focus-within:text-white"
                      >Database <span class="text-red-500">*</span></label
                    >
                  </div>
                  <div class="flex items-center">
                    <input
                      type="text"
                      name="database"
                      class="placeholder:text-muted-foreground/90 text-foreground block w-full border-0 bg-transparent p-0 text-sm file:my-1 focus:outline-none focus:ring-0 focus:ring-teal-500 sm:leading-7"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-4 flex w-full items-center justify-end gap-x-2">
              <button
                class="inline-flex h-10 w-full items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-black transition duration-300 hover:bg-black hover:text-white hover:ring hover:ring-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                type="submit"
              >
                Connect
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
