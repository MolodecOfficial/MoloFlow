<script setup lang="ts">

</script>

<template>
<section class="form-section">
  <section class="form-header">
    <slot name="header"/>
  </section>
  <section class="form-main">
    <slot name="main"/>
  </section>
</section>
</template>

<style scoped>
.form-section {
  position: relative;
  overflow: hidden;
  width: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: var(--half_opacity_bg);

  border-radius: 10px;

  border: 1px solid rgba(255, 255, 255, 0.09);

  backdrop-filter: blur(8px);


  transition: all .25s ease;
}

.form-section::before {
  content: '';

  position: absolute;
  inset: 0;

  border-radius: inherit;

  padding: 1px;

  background:
      linear-gradient(
          135deg,
          rgba(255, 255, 255, 0.15),
          rgba(255, 255, 255, 0.02),
          rgba(255, 255, 255, 0.11)
      );

  -webkit-mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);

  -webkit-mask-composite: xor;
  mask-composite: exclude;

  pointer-events: none;
}

.form-section::after {
  content: '';

  position: absolute;

  width: 300px;
  height: 300px;

  top: -150px;
  left: -150px;
  border-radius: 50%;
  transition: all .6s ease;

  pointer-events: none;
}

.form-section:hover::after {
  left: calc(100% - 150px);
}

.form-header {
  position: relative;

  display: flex;
  justify-content: space-between;
  align-items: center;

  flex-shrink: 0;

  padding: 16px 20px;

  border-bottom: 1px solid rgba(255,255,255,.08);

  background:
      linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.02),
          transparent
      );
}


.form-main {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>