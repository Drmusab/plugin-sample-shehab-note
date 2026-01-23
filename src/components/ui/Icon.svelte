<script lang="ts">
  import { getIconUrl, type IconCategory, type IconSize } from '@/assets/icons';

  interface Props {
    category: IconCategory;
    name: string;
    size?: IconSize;
    alt?: string;
    class?: string;
  }

  let {
    category,
    name,
    size = 16,
    alt = '',
    class: className = '',
  }: Props = $props();

  const src = $derived(getIconUrl(category, name, size));
</script>

{#if src}
  <img
    {src}
    width={size}
    height={size}
    {alt}
    class="icon {className}"
    loading="lazy"
    decoding="async"
  />
{:else}
  <!-- Fallback for missing icons -->
  <span
    class="icon-fallback {className}"
    style="width: {size}px; height: {size}px"
    aria-label={alt || `${category} ${name} icon`}
    role="img"
  >
    ?
  </span>
{/if}

<style>
  .icon {
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
  }

  .icon-fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--b3-theme-error-light, var(--background-modifier-error, #fee));
    border-radius: 2px;
    font-size: 10px;
    color: var(--b3-theme-error, var(--text-error, #c00));
    font-weight: bold;
  }
</style>
